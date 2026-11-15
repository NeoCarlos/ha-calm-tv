import {
  Auth,
  type AuthData,
  type Connection,
  type HassEntities,
  callService,
  createConnection,
  createLongLivedTokenAuth,
  getAuth,
  subscribeEntities,
  ERR_CANNOT_CONNECT,
  ERR_INVALID_AUTH,
} from 'home-assistant-js-websocket';
import { settings } from './config';

// Home Assistant's address comes from the TV's settings (or VITE_HA_URL in a browser): see config.ts.
const haUrl = () => settings.haUrl;

const TOKENS_KEY = 'ct.haTokens';

export type HaStatus = 'signed-out' | 'connecting' | 'connected' | 'offline';

export interface ForecastEntry {
  datetime: string;
  condition?: string;
  temperature?: number;
  templow?: number;
  precipitation?: number;
  precipitation_probability?: number;
}

type Listener = () => void;

function loadTokens(): AuthData | null {
  try {
    const raw = localStorage.getItem(TOKENS_KEY);
    const data = raw ? (JSON.parse(raw) as AuthData) : null;
    // Tokens belong to one Home Assistant: forget them if the address was changed.
    return data && data.hassUrl === settings.haUrl ? data : null;
  } catch {
    return null;
  }
}
function saveTokens(data: AuthData | null): void {
  try {
    if (data) localStorage.setItem(TOKENS_KEY, JSON.stringify(data));
    else localStorage.removeItem(TOKENS_KEY);
  } catch {
    /* storage unavailable: stays signed in until the page reloads */
  }
}

/**
 * The live link to Home Assistant. Signs in with HA's own login page (OAuth, so no token is
 * ever typed or pasted), keeps the tokens, and holds the latest state of every entity.
 * The library reconnects by itself after a drop; this also retries a failed first connect.
 */
class HomeAssistant {
  status: HaStatus = 'signed-out';
  entities: HassEntities = {};
  userName = '';
  private conn: Connection | null = null;
  private auth: Auth | null = null;
  private retryTimer = 0;
  private retryDelay = 5000;
  private statusListeners: Listener[] = [];
  private entityListeners: Listener[] = [];
  private connectedListeners: ((c: Connection) => void)[] = [];

  onStatus(fn: Listener): void { this.statusListeners.push(fn); }
  onEntities(fn: Listener): void { this.entityListeners.push(fn); }
  /** Runs each time a connection is (re)established, e.g. to (re)subscribe to forecasts. */
  onConnected(fn: (c: Connection) => void): void {
    this.connectedListeners.push(fn);
    if (this.conn && this.status === 'connected') fn(this.conn);
  }

  /** Connect if we have tokens or just came back from the sign-in page. Never redirects by itself. */
  async start(): Promise<void> {
    // Dev on the Mac only (see vite.config.ts): connect with the dev token when the server offers one.
    if (import.meta.env.DEV && new URLSearchParams(location.search).has('devtoken')) {
      const r = await fetch('/__dev-token').catch(() => null);
      if (r?.ok) {
        this.auth = createLongLivedTokenAuth(haUrl(), await r.text());
        await this.connect();
        return;
      }
    }
    const callback = new URLSearchParams(location.search).has('auth_callback');
    if (!haUrl() || (!callback && !loadTokens())) {
      this.setStatus('signed-out');
      return;
    }
    await this.connect();
  }

  /** Opens Home Assistant's sign-in page; it returns to Calm TV when done. */
  async signIn(): Promise<void> {
    saveTokens(null);
    if (!haUrl()) return;
    await getAuth({ hassUrl: haUrl(), limitHassInstance: true, saveTokens, loadTokens: async () => null });
  }

  async signOut(): Promise<void> {
    console.info('[CalmTV] Signed out of Home Assistant from Settings');
    const auth = this.auth;
    this.teardown();
    saveTokens(null);
    this.setStatus('signed-out');
    try { await auth?.revoke(); } catch { /* offline: the tokens are forgotten here anyway */ }
  }

  async call(domain: string, service: string, data: Record<string, unknown>): Promise<void> {
    if (!this.conn) return;
    try {
      await callService(this.conn, domain, service, data);
    } catch (e) {
      console.warn('HA service call failed', domain, service, data, e);
    }
  }

  /** The live connection, when connected. */
  get connection(): Connection | null {
    return this.status === 'connected' ? this.conn : null;
  }

  /** A path on HA (e.g. a camera picture) as a full URL. */
  url(path: string): string {
    return path.startsWith('http') ? path : haUrl() + path;
  }

  private async connect(): Promise<void> {
    clearTimeout(this.retryTimer);
    this.setStatus('connecting');
    try {
      this.auth ??= await getAuth({ hassUrl: haUrl(), limitHassInstance: true, saveTokens, loadTokens: async () => loadTokens() });
      // Drop ?auth_callback=1&code=... from the address so a reload doesn't reuse the code.
      if (location.search.includes('auth_callback')) history.replaceState(null, '', location.pathname);
      const conn = await createConnection({ auth: this.auth });
      this.conn = conn;
      this.retryDelay = 5000;
      conn.addEventListener('ready', () => this.connected(conn));
      conn.addEventListener('disconnected', () => this.setStatus('offline'));
      conn.addEventListener('reconnect-error', (_c, err) => {
        if (err === ERR_INVALID_AUTH) this.lostAuth();
      });
      subscribeEntities(conn, (ents) => {
        this.entities = ents;
        this.entityListeners.forEach((fn) => fn());
      });
      this.connected(conn);
      conn
        .sendMessagePromise<{ name: string }>({ type: 'auth/current_user' })
        .then((u) => { this.userName = u.name; this.statusListeners.forEach((fn) => fn()); })
        .catch(() => {});
    } catch (err) {
      const badCallback = location.search.includes('auth_callback');
      if (badCallback) history.replaceState(null, '', location.pathname);
      if (err === ERR_INVALID_AUTH || badCallback) {
        if (badCallback) console.warn('[CalmTV] Home Assistant sign-in callback failed', err);
        this.lostAuth();
      } else {
        // ERR_CANNOT_CONNECT (HA or Tailscale down) or a network error: try again, backing off to 1 minute.
        if (err !== ERR_CANNOT_CONNECT) console.warn('HA connect failed', err);
        this.setStatus('offline');
        this.retryTimer = window.setTimeout(() => this.connect(), this.retryDelay);
        this.retryDelay = Math.min(this.retryDelay * 2, 60000);
      }
    }
  }

  private connected(conn: Connection): void {
    this.setStatus('connected');
    this.connectedListeners.forEach((fn) => fn(conn));
  }

  /** The tokens were refused (e.g. the TV user was removed or signed out in HA). */
  private lostAuth(): void {
    console.warn('[CalmTV] Home Assistant refused the saved sign-in; signed out');
    this.teardown();
    saveTokens(null);
    this.setStatus('signed-out');
  }

  private teardown(): void {
    clearTimeout(this.retryTimer);
    this.conn?.close();
    this.conn = null;
    this.auth = null;
    this.userName = '';
  }

  private setStatus(s: HaStatus): void {
    if (s !== this.status) console.info(`[CalmTV] Home Assistant: ${s}`);
    this.status = s;
    this.statusListeners.forEach((fn) => fn());
  }
}

export const ha = new HomeAssistant();
