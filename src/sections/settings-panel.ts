import { native } from '../native';
import { ha } from '../ha';
import { settings } from '../config';
import { zones } from '../home-data';
import { showSetup } from '../setup';

// Line icons, matching the room panels' style.
const line = (d: string) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
const ICONS = {
  google: line('<path d="M4 11l8-6 8 6"/><path d="M6 10v9h12v-9"/><path d="M10 19v-5h4v5"/>'),
  tv: line('<rect x="3" y="5" width="18" height="12" rx="2"/><path d="M8 21h8M12 17v4"/>'),
  wallpaper: line('<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 16l5-5 4 4 3-3 6 6"/><circle cx="15.5" cy="8.5" r="1.5"/>'),
  close: line('<path d="M6 6l12 12M18 6L6 18"/>'),
  ha: line('<path d="M3 11l9-7 9 7"/><path d="M5 9.5V20h14V9.5"/><circle cx="12" cy="14" r="2"/><path d="M12 16v4"/>'),
  link: line('<path d="M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1 1"/><path d="M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1-1"/>'),
  file: line('<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h6"/>'),
};

/** The background choices, owned by the app. */
export interface BackgroundControls {
  mode(): 'photo' | 'video';
  /** Name of the current photo or clip. */
  name(): string;
  openPicker(): void;
}

interface Row {
  icon: string;
  name: string | (() => string);
  status: () => string;
  run: () => void;
}

/**
 * Calm TV's own settings, opened from the gear tile at the end of the app dock.
 * Reuses the room panel's look (.detail, .drow), as a single narrower column.
 */
export class SettingsPanel {
  private readonly el: HTMLElement;
  private readonly listEl: HTMLElement;
  private readonly closeEl: HTMLElement;
  private rows: Row[];
  private rowEls: HTMLElement[] = [];
  private open = false;
  private focus = 0; // -1 = the close button
  private confirmSignOut = false;
  private confirmTimer = 0;
  /** OK presses right after opening belong to the press that opened the panel. */
  private openedAt = 0;

  constructor(mount: HTMLElement, private bg: BackgroundControls) {
    const onTv = !!native;
    this.rows = [
      {
        icon: ICONS.google,
        name: 'Google TV home',
        status: () =>
          onTv ? 'Switch to Google’s home screen. Open Calm TV from its apps to come back.' : 'Only on the TV',
        run: () => {
          this.close();
          native?.openGoogleHome();
        },
      },
      {
        icon: ICONS.ha,
        name: 'Home Assistant',
        status: () =>
          ha.status === 'signed-out' ? 'Not signed in · OK to sign in'
          : this.confirmSignOut ? 'Press OK again to sign out'
          : ha.status === 'connecting' ? 'Connecting…'
          : ha.status === 'offline' ? 'Can’t reach Home Assistant · trying again'
          : `Connected${ha.userName ? ` as ${ha.userName}` : ''}`,
        run: () => {
          if (ha.status === 'signed-out') { this.close(); ha.signIn(); return; }
          // Signing out takes two presses, so a stray OK can't do it.
          if (!this.confirmSignOut) {
            this.confirmSignOut = true;
            clearTimeout(this.confirmTimer);
            this.confirmTimer = window.setTimeout(() => { this.confirmSignOut = false; this.refresh(); }, 4000);
          } else {
            this.confirmSignOut = false;
            ha.signOut();
          }
          this.paint();
        },
      },
      {
        icon: ICONS.link,
        name: 'Home Assistant address',
        status: () => `${settings.haUrl || 'Not set'} · OK to change`,
        run: () => {
          this.close();
          showSetup({ canCancel: true });
        },
      },
      {
        icon: ICONS.file,
        name: 'Home setup (calm-tv.json)',
        status: () => {
          const rooms = `${zones.length} room${zones.length === 1 ? '' : 's'}`;
          if (!settings.source) return `Not found${settings.error ? ` (${settings.error})` : ''} · OK to look again`;
          const from = settings.source === 'last saved copy' ? 'Using the last saved copy' : `From ${settings.source}`;
          return `${from} · ${rooms}${settings.error ? ` · newest copy has a problem: ${settings.error}` : ''} · OK to reload`;
        },
        run: () => location.reload(),
      },
      {
        icon: ICONS.tv,
        name: 'TV settings',
        status: () => (onTv ? 'Network, display, accounts, and more' : 'Only on the TV'),
        run: () => {
          this.close();
          native?.openSettings();
        },
      },
      {
        icon: ICONS.wallpaper,
        name: 'Background',
        status: () => `${this.bg.name()} · ${this.bg.mode() === 'video' ? 'video' : 'photo'} · OK to choose`,
        run: () => {
          this.close();
          this.bg.openPicker();
        },
      },
    ];

    this.el = document.createElement('div');
    this.el.className = 'detail settings';
    this.el.innerHTML = `
      <div class="detail-scrim"></div>
      <div class="detail-panel">
        <div class="detail-head">
          <div class="detail-title">Settings</div>
          <button class="detail-close" aria-label="Close">${ICONS.close}</button>
        </div>
        <div class="dcol-list"></div>
      </div>`;
    mount.appendChild(this.el);
    this.listEl = this.el.querySelector('.dcol-list') as HTMLElement;
    this.closeEl = this.el.querySelector('.detail-close') as HTMLElement;
    this.closeEl.addEventListener('click', () => this.close());
    this.el.querySelector('.detail-scrim')!.addEventListener('click', () => this.close());

    this.rows.forEach((r, i) => {
      const row = document.createElement('button');
      row.className = 'drow';
      row.addEventListener('mouseenter', () => { this.focus = i; this.render(); });
      row.addEventListener('click', () => { this.focus = i; r.run(); });
      this.listEl.appendChild(row);
      this.rowEls.push(row);
    });
  }

  isOpen(): boolean {
    return this.open;
  }

  show(): void {
    this.focus = 0;
    this.confirmSignOut = false;
    this.openedAt = Date.now();
    this.open = true;
    this.paint();
    this.el.classList.add('open');
  }

  close(): void {
    this.open = false;
    this.el.classList.remove('open');
  }

  /** Repaint the status lines (e.g. the Home Assistant connection changed). */
  refresh(): void {
    if (this.open) this.paint();
  }

  handleKey(e: KeyboardEvent): void {
    const k = e.key;
    if (k === 'Escape' || k === 'Backspace') { e.preventDefault(); this.close(); return; }
    if (k === 'Enter' || k === ' ') {
      e.preventDefault();
      if (e.repeat || Date.now() - this.openedAt < 400) return;
      if (this.focus < 0) this.close(); else this.rows[this.focus].run();
      return;
    }
    if (this.confirmSignOut && k.startsWith('Arrow')) { this.confirmSignOut = false; this.paint(); }
    if (k === 'ArrowUp') { e.preventDefault(); this.focus = Math.max(-1, this.focus - 1); this.render(); }
    else if (k === 'ArrowDown') { e.preventDefault(); this.focus = Math.min(this.rows.length - 1, this.focus + 1); this.render(); }
    else if (k.startsWith('Arrow')) e.preventDefault();
  }

  private paint(): void {
    this.rows.forEach((r, i) => {
      this.rowEls[i].innerHTML =
        `<div class="dicon">${r.icon}</div>` +
        `<div class="dmeta"><div class="dname">${typeof r.name === 'function' ? r.name() : r.name}</div><div class="dstatus">${r.status()}</div></div>`;
    });
    this.render();
  }

  private render(): void {
    this.closeEl.classList.toggle('focus', this.focus < 0);
    this.rowEls.forEach((el, i) => el.classList.toggle('focus', i === this.focus));
  }
}
