import { child } from '../dom';
import { FocusGroup } from '../focus';
import { hint } from '../hints';
// Choose the background: a strip of thumbnails along the bottom, of videos while video backgrounds
// are on (Settings → Appearance), of photos otherwise. While it's open the screens fade away, so
// the chosen background shows full screen behind it.

export interface BgChoice {
  kind: 'video' | 'photo';
  index: number;
}

export interface BgOption extends BgChoice {
  name: string;
  thumb: string;
  /** It has versions for the times of day, and follows them (see sky.ts). */
  timeOfDay?: boolean;
}

/** The badge on a background that follows the time of day: half sun, half moon. */
const TIME_OF_DAY = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4a8 8 0 0 0 0 16z" fill="currentColor"/>`
  + `<path d="M12 4a8 8 0 0 1 0 16" fill="none" stroke="currentColor" stroke-width="2"/>`
  + `<path d="M12 1.5v1.5M4.6 4.6l1 1M1.5 12h1.5M4.6 19.4l1-1" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>`;

const TILE_W = 288;
const TILE_GAP = 24;
const SHELF_W = 1760;
const EDGE = 80;

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

export class BackgroundPicker {
  private readonly el: HTMLElement;
  private readonly track: HTMLElement;
  private readonly titleEl: HTMLElement;
  private tiles: { el: HTMLElement; opt: BgOption; x: number }[] = [];
  private focus = 0;
  private offset = 0;
  private open = false;
  private nav: FocusGroup;

  constructor(
    mount: HTMLElement,
    private options: () => BgOption[],
    private current: () => BgChoice,
    private choose: (c: BgChoice) => void,
  ) {
    this.el = document.createElement('div');
    this.el.className = 'bgpick';
    this.el.innerHTML = `
      <div class="bgpick-shade"></div>
      <div class="bgpick-head"><span class="bgpick-title">Background</span><span class="bgpick-hint">${hint('backgroundPicker')}</span><button class="bgpick-done">Done</button></div>
      <div class="bgpick-shelf"><div class="bgpick-track"></div></div>`;
    mount.appendChild(this.el);
    child(this.el, '.bgpick-done').addEventListener('click', () => this.close());
    this.track = child(this.el, '.bgpick-track');
    this.titleEl = child(this.el, '.bgpick-title');
    // Remote, touch and mouse (see focus.ts). The shelf slides itself, so the focus tells it where.
    this.nav = new FocusGroup(this.el, {
      onBack: () => this.close(),
      scrollIntoView: false,
      onFocus: (id) => {
        this.focus = Number(id.split('-')[1]);
        this.render();
      },
    });
  }

  /** Builds a tile per option; the options change with the video setting. */
  private build(): void {
    this.track.textContent = '';
    this.tiles = [];
    this.options().forEach((opt, i) => {
      const el = document.createElement('div');
      const x = i * (TILE_W + TILE_GAP);
      el.className = 'bgpick-tile';
      el.style.left = `${x}px`;
      el.innerHTML = `<div class="bgpick-img" style="background-image:url('${opt.thumb}')">`
        + `${opt.timeOfDay ? `<span class="bgpick-tod">${TIME_OF_DAY}</span>` : ''}</div>`
        + `<div class="bgpick-name">${esc(opt.name)}</div>`
        + `${opt.timeOfDay ? '<div class="bgpick-sub">Changes with the time of day</div>' : ''}`;
      el.dataset.focus = `background-${i}`;
      el.addEventListener('click', () => this.pick(i));
      this.track.appendChild(el);
      this.tiles.push({ el, opt, x });
    });
  }

  isOpen(): boolean {
    return this.open;
  }

  show(): void {
    this.build();
    const cur = this.current();
    this.titleEl.textContent = cur.kind === 'video' ? 'Video background' : 'Photo background';
    const i = this.tiles.findIndex((t) => t.opt.kind === cur.kind && t.opt.index === cur.index);
    this.focus = Math.max(0, i);
    this.open = true;
    document.documentElement.classList.add('picking');
    this.el.classList.add('open');
    this.render();
    this.nav.focus(`background-${this.focus}`);
  }

  close(): void {
    this.open = false;
    document.documentElement.classList.remove('picking');
    this.el.classList.remove('open');
  }

  handleKey(e: KeyboardEvent): void {
    this.nav.handleKey(e);
  }

  private pick(i: number): void {
    const t = this.tiles[i];

    if (!t) return;
    this.choose({ kind: t.opt.kind, index: t.opt.index });
    this.render();
  }

  /** Marks the chosen tile, and slides the shelf so the focused one is on screen. */
  private render(): void {
    const cur = this.current();
    this.tiles.forEach((t) => t.el.classList.toggle('chosen', t.opt.kind === cur.kind && t.opt.index === cur.index));
    const t = this.tiles[this.focus];
    const total = this.tiles.length ? this.tiles[this.tiles.length - 1].x + TILE_W : 0;

    if (total <= SHELF_W) this.offset = -(SHELF_W - total) / 2;
    else if (t) {
      if (this.offset < 0) this.offset = 0;

      if (t.x - this.offset < EDGE) this.offset = t.x - EDGE;

      if (t.x + TILE_W - this.offset > SHELF_W - EDGE) this.offset = t.x + TILE_W - SHELF_W + EDGE;
      this.offset = Math.max(0, Math.min(this.offset, total - SHELF_W));
    }

    this.track.style.transform = `translateX(${-this.offset}px)`;
  }
}
