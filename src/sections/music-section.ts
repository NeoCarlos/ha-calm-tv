import { ha } from '../ha';
import { haPath, dashboardMode } from '../config';
import { musicBackground, onLookChange } from '../look';
import { child } from '../dom';
import { artTint, ICON, speaker, type Control, type MusicPanel } from './music-panel';
import type { Section } from './section';

// The Music screen: a calm view of what's playing, like the Weather and Calendar screens. The album
// art, with the song, the artist and the time beneath it, sits above the frosted bar of controls;
// after a few seconds without a key press the bar fades away and only the art and its caption stay. Everything else (speakers,
// grouping, the queue, the library) is one press away under More, in the Music panel
// (music-panel.ts), which also does the work behind the buttons here.

/** Seconds without a key press (or touch) before the bar fades out. */
const FADE_AFTER = 8;

const MORE = '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>';

/** The bar's buttons, left to right. */
const BUTTONS = ['prev', 'playpause', 'next', 'volDown', 'volUp', 'more'] as const;
type Button = (typeof BUTTONS)[number];


const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

export class MusicSection implements Section {
  readonly el: HTMLElement;
  /** Play/pause, so arriving on the screen and pressing OK pauses or plays. */
  readonly defaultItem = 1;
  private buttons: HTMLElement[] = [];
  private focused = 1;
  private active = false;
  private calmTimer = 0;
  private tick = 0;
  private artUrl: string | null = null;

  constructor(private secIndex: number, private panel: MusicPanel) {
    this.el = document.createElement('section');
    this.el.className = 'section';
    this.el.id = 'secMusic';
    // How the album's colour shows behind it (Settings, or "background" under "music"; see style.css).
    this.el.dataset.glow = musicBackground();
    onLookChange(() => { this.el.dataset.glow = musicBackground(); });
    this.el.innerHTML = `
      <div class="mx-glow"></div>
      <div class="mx-art"></div>
      <div class="mx-caption"><div class="mx-title"></div><div class="mx-artist"></div><div class="mx-time"></div></div>
      <div class="gb" id="mxbar">
        <div class="gb-mat"><div class="gb-img"></div><div class="gb-veil"></div></div>
        <div class="gb-edge"></div>
        <div class="mx-row">
          <div class="mx-speaker"></div>
          <div class="mx-mid"></div>
          <div class="mx-end"><span class="mx-vol"></span></div>
        </div>
      </div>`;

    const mid = child(this.el, '.mx-mid');
    const end = child(this.el, '.mx-end');
    this.buttons = BUTTONS.map((b, i) => {
      const btn = document.createElement('button');
      btn.className = `mxb${b === 'playpause' ? ' big' : ''}${b === 'more' ? ' more' : ''}`;
      btn.dataset.sec = String(this.secIndex);
      btn.dataset.item = String(i);
      btn.setAttribute('aria-label', LABELS[b]);

      if (b === 'volDown') end.prepend(btn);
      else if (b === 'volUp' || b === 'more') end.appendChild(btn);
      else mid.appendChild(btn);

      return btn;
    });

    // A touch anywhere on the screen (or a mouse moving over it) brings the bar back.
    this.el.addEventListener('pointerdown', () => this.wake());
    this.el.addEventListener('pointermove', (e) => { if (e.pointerType === 'mouse') this.wake(); });
    ha.onEntities(() => { if (this.active) this.render(); });
    this.render();
  }

  // ---------- Section ----------

  count(): number {
    return this.buttons.length;
  }

  focus(i: number): void {
    this.focused = i;
    this.buttons.forEach((b, j) => b.classList.toggle('is-focus', j === i));
    this.wake();
  }

  blur(): void {
    this.buttons.forEach((b) => b.classList.remove('is-focus'));
  }

  activate(i: number): void {
    const b = BUTTONS[i];

    if (b === 'more') this.panel.show();
    else if (b) this.panel.control(b satisfies Control);
    this.render();
    this.wake();
  }

  onEnter(): void {
    this.active = true;
    this.render();
    clearInterval(this.tick);
    this.tick = window.setInterval(() => {
      if (!this.el.classList.contains('is-active')) {
        this.leave();

        return;
      }

      this.render();
    }, 1000);
    this.wake();
  }

  /**
   * While the bar has faded, the first OK, ← or → only brings it back (so waking the screen never
   * skips a song by accident). Up and Down still change screens. Returns true when the key was used.
   */
  wakeKey(key: string): boolean {
    const calm = this.el.classList.contains('calm');
    this.wake();

    return calm && ['Enter', ' ', 'ArrowLeft', 'ArrowRight'].includes(key);
  }

  // ---------- the calm view ----------

  private wake(): void {
    this.el.classList.remove('calm');
    clearTimeout(this.calmTimer);

    if (this.active) this.calmTimer = window.setTimeout(() => this.el.classList.add('calm'), FADE_AFTER * 1000);
  }

  private leave(): void {
    this.active = false;
    clearInterval(this.tick);
    clearTimeout(this.calmTimer);
    this.el.classList.remove('calm');
  }

  private render(): void {
    const p = this.panel.current();
    const s = p ? speaker(p.entity) : undefined;
    const on = s?.state === 'playing' || s?.state === 'paused';
    const a = s?.a;

    // Nothing playing: no art, no words, just the background (and the bar, until it fades).
    this.el.classList.toggle('idle', !on);
    const pic = on && a?.entity_picture ? haPath(a.entity_picture) : '';

    if (pic !== this.artUrl) {
      this.artUrl = pic;
      child(this.el, '.mx-art').innerHTML = pic ? `<img src="${esc(pic)}" alt="">` : '';
      this.el.classList.remove('tinted');

      void artTint(pic).then((rgb) => {
        if (this.artUrl !== pic || !rgb) return;
        this.el.style.setProperty('--art-tint', rgb);
        this.el.classList.add('tinted');
      });
    }

    child(this.el, '.mx-title').textContent = on ? a?.media_title ?? '' : '';
    child(this.el, '.mx-artist').textContent = on ? a?.media_artist ?? '' : '';
    child(this.el, '.mx-speaker').innerHTML = p ? `${ICON.volUp}<span>${esc(p.name)}</span>` : '';

    this.buttons.forEach((btn, i) => {
      const b = BUTTONS[i];
      btn.innerHTML = b === 'more' ? `${MORE}<span>More</span>` : b === 'playpause' ? (s?.state === 'playing' ? ICON.pause : ICON.play) : ICON[b];
      btn.setAttribute('aria-label', b === 'playpause' && s?.state === 'playing' ? 'Pause' : LABELS[b]);
    });

    const vol = this.panel.level();
    child(this.el, '.mx-vol').textContent = vol === undefined ? '' : `${Math.round(vol * 100)}%`;

    // How far into the song, under the artist ("1:04 / 4:07"); a stream with no length shows nothing.
    const dur = on ? a?.media_duration ?? 0 : 0;
    let pos = a?.media_position ?? 0;

    if (s?.state === 'playing' && a?.media_position_updated_at) pos += (Date.now() - Date.parse(a.media_position_updated_at)) / 1000;
    child(this.el, '.mx-time').textContent = dur ? `${mmss(Math.min(pos, dur))} / ${mmss(dur)}` : '';
  }
}

const LABELS: Record<Button, string> = {
  prev: 'Previous', playpause: 'Play', next: 'Next', volDown: 'Volume down', volUp: 'Volume up', more: dashboardMode ? 'Speakers, queue and library' : 'More',
};
