import { native } from './native';
import type { DeviceType } from './types';

/**
 * calm-tv.json: everything specific to one home, so the same app works anywhere.
 * See config/calm-tv.example.json for a complete example, and docs/configuration.md.
 *
 * Where it comes from:
 *  - On the TV: Home Assistant's www folder (http://<ha>/local/calm-tv.json), else a file
 *    pushed onto the TV with adb (android/.../ConfigFile.kt reads both).
 *  - In a desktop browser (npm run dev): calm-tv.json in the project folder.
 *  - Either way, the last good copy is kept, in case neither can be reached on a later start.
 */
export interface CalmTvConfig {
  /** The app dock, in order. `icon` is a file name from src/icons/ (e.g. "netflix"); `package` the Android TV app. */
  apps?: { name: string; package: string; icon?: string }[];
  /** Weather entity for the Weather screen and the Smart Home "Outside" line. */
  weather?: string;
  /** Calendar entities: `events` fill the Calendar bar; `meals` (optional) gives "Dinner · …" from today's all-day event. */
  calendar?: { events?: string; meals?: string };
  /** Doorbell video window (off unless `window` is true): its camera, and an input_boolean that is on while it rings. */
  doorbell?: { window?: boolean; camera?: string; ringing?: string };
  /** Rooms in the Smart Home bar, in order. */
  rooms?: RoomConfig[];
  /** Look options. */
  display?: {
    /** The bars' glass: "blur" (frosted, the default) or "tint" (plain dark glass, no blur; lightest on the TV). */
    glass?: 'blur' | 'tint';
    /** false hides video backgrounds; only photos are offered (default true). */
    videos?: boolean;
  };
  /** Extra backgrounds, e.g. files in Home Assistant's www folder ("/local/beach.jpg"). */
  backgrounds?: {
    photos?: { name: string; url: string }[];
    videos?: { name: string; url: string; thumb?: string }[];
  };
}

export type RoomIcon = 'couch' | 'cutlery' | 'desk' | 'bed' | 'stairs' | 'house';

export interface RoomConfig {
  name: string;
  icon?: RoomIcon;
  /** Summary when nothing is on (default "All off"). */
  whenIdle?: string;
  /** Lock entities: the room turns amber if one is left unlocked for 10 minutes. */
  locks?: string[];
  /** A sensor whose state is a short "needs attention" note (shown when nothing is urgent). */
  maintenance?: string;
  /** A robot vacuum: entity id stems of the vacuum and its dock (Roborock integration naming). */
  vacuum?: { label: string; vacuum: string; dock: string };
  /** A binary sensor that becomes the room's urgent status while on, e.g. a garage door. */
  alert?: { entity: string; text: string };
  groups: { title: string; devices: DeviceConfig[] }[];
}

export interface DeviceConfig {
  type: DeviceType;
  entity: string;
  /** Shown name (defaults to the entity id). */
  name?: string;
  /** Battery sensors; the lowest is shown (covers, locks). */
  batteries?: string[];
  /** Lock: sensor saying how it was last locked. */
  operator?: string;
  /** Lock: a keypad's battery sensor. */
  keypad?: string;
}

const DEVICE_TYPES: DeviceType[] = ['light', 'switch', 'lock', 'camera', 'climate', 'cover', 'sensor', 'scene'];
const CACHE_KEY = 'ct.config';
const HA_URL_KEY = 'ct.haUrl';

export const settings = {
  /** The loaded configuration ({} if none). */
  config: {} as CalmTvConfig,
  /** Where it came from: "Home Assistant", "this TV", "this project folder", "last saved copy", or "". */
  source: '',
  /** Why the newest copy couldn't be used, if it couldn't. */
  error: '',
  /** Home Assistant's address, e.g. "http://192.168.1.20:8123" ("" until it's set up). */
  haUrl: '',
};

/** Home Assistant's address: set on the TV (Settings or adb), or VITE_HA_URL / the saved one in a browser. */
function readHaUrl(): string {
  if (native?.getHaUrl) return native.getHaUrl();
  try {
    return import.meta.env.VITE_HA_URL || localStorage.getItem(HA_URL_KEY) || '';
  } catch {
    return import.meta.env.VITE_HA_URL || '';
  }
}

/** Saves Home Assistant's address; returns the cleaned-up address, or "" if it isn't valid. */
export function saveHaUrl(raw: string): string {
  if (native?.setHaUrl) return native.setHaUrl(raw);
  let s = raw.trim();
  if (!s) return '';
  if (!s.includes('://')) s = `http://${s}`;
  try {
    const u = new URL(s);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return '';
    localStorage.setItem(HA_URL_KEY, u.origin);
    return u.origin;
  } catch {
    return '';
  }
}

/** Checks the shape enough to fail with a clear message instead of a blank screen. */
function validate(c: unknown): CalmTvConfig {
  if (!c || typeof c !== 'object' || Array.isArray(c)) throw new Error('it should be a JSON object { … }');
  const cfg = c as CalmTvConfig;
  const glass = cfg.display?.glass;
  if (glass !== undefined && glass !== 'blur' && glass !== 'tint') throw new Error(`"display": "glass" should be "blur" or "tint", not "${glass}"`);
  const vids = cfg.display?.videos;
  if (vids !== undefined && typeof vids !== 'boolean') throw new Error(`"display": "videos" should be true or false`);
  (cfg.rooms ?? []).forEach((r, i) => {
    if (!r?.name) throw new Error(`room ${i + 1} has no "name"`);
    if (!Array.isArray(r.groups)) throw new Error(`room "${r.name}" needs "groups": [ … ]`);
    r.groups.forEach((g) =>
      (g.devices ?? []).forEach((d) => {
        if (!d?.entity) throw new Error(`a device in "${r.name}" has no "entity"`);
        if (!DEVICE_TYPES.includes(d.type)) throw new Error(`"${d.entity}" has type "${d.type}"; use one of ${DEVICE_TYPES.join(', ')}`);
      }),
    );
  });
  return cfg;
}

async function fetchProjectFile(): Promise<string> {
  try {
    const r = await fetch('calm-tv.json', { cache: 'no-store' });
    // The dev server answers unknown paths with the page itself; only take real JSON.
    if (r.ok && (r.headers.get('content-type') ?? '').includes('json')) return await r.text();
  } catch {
    /* not there */
  }
  return '';
}

/** Loads Home Assistant's address and calm-tv.json. Call once, before the screens are built. */
export async function loadConfig(): Promise<void> {
  settings.haUrl = readHaUrl();
  let text = '';
  let source = '';
  if (native?.loadConfig) {
    try {
      const r = JSON.parse(native.loadConfig()) as { source?: string; text?: string; error?: string };
      text = r.text ?? '';
      source = r.source ?? '';
      settings.error = r.error ?? '';
    } catch (e) {
      settings.error = String(e);
    }
  } else {
    text = await fetchProjectFile();
    source = text ? 'this project folder' : '';
    if (!text) settings.error = 'no calm-tv.json in the project folder';
  }

  if (text) {
    try {
      settings.config = validate(JSON.parse(text));
      settings.source = source;
      settings.error = '';
      try { localStorage.setItem(CACHE_KEY, text); } catch { /* storage full or off */ }
      return;
    } catch (e) {
      settings.error = `calm-tv.json from ${source}: ${(e as Error).message}`;
    }
  }
  // Fall back to the last copy that worked.
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
      settings.config = validate(JSON.parse(cached));
      settings.source = 'last saved copy';
    }
  } catch {
    /* nothing usable */
  }
}

/** A path on Home Assistant ("/local/x.jpg") as a full address; full addresses are kept. */
export function haPath(url: string): string {
  return /^[a-z]+:/i.test(url) || !settings.haUrl ? url : settings.haUrl + (url.startsWith('/') ? '' : '/') + url;
}
