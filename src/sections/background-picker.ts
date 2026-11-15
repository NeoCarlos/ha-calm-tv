// Choose the background: a strip of thumbnails along the bottom, videos first, then photos.
// While it's open the screens fade away, so the chosen background shows full screen behind it.

export interface BgChoice {
  kind: 'video' | 'photo';
  index: number;
}

export interface BgOption extends BgChoice {
  name: string;
  thumb: string;
}

const TILE_W = 288;
const TILE_GAP = 24;
const GROUP_GAP = 56;
const SHELF_W = 1760;
const EDGE = 80;

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

export class BackgroundPicker {
  private readonly el: HTMLElement;
  private readonly track: HTMLElement;
  private tiles: { el: HTMLElement; opt: BgOption; x: number }[] = [];
  private focus = 0;
  private offset = 0;
  private open = false;

  constructor(
    mount: HTMLElement,
    private options: BgOption[],
    private current: () => BgChoice,
    private choose: (c: BgChoice) => void,
  ) {
    this.el = document.createElement('div');
    this.el.className = 'bgpick';
    this.el.innerHTML = `
      <div class="bgpick-shade"></div>
      <div class="bgpick-head"><span class="bgpick-title">Background</span><span class="bgpick-hint">OK to choose · Back when done</span></div>
      <div class="bgpick-shelf"><div class="bgpick-track"></div></div>`;
    mount.appendChild(this.el);
    this.track = this.el.querySelector('.bgpick-track') as HTMLElement;

    let x = 0;
    let lastKind = '';
    for (const opt of this.options) {
      if (opt.kind !== lastKind) {
        if (lastKind) x += GROUP_GAP - TILE_GAP;
        this.track.insertAdjacentHTML('beforeend', `<div class="bgpick-group" style="left:${x}px">${opt.kind === 'video' ? 'Videos' : 'Photos'}</div>`);
        lastKind = opt.kind;
      }
      const el = document.createElement('div');
      el.className = 'bgpick-tile';
      el.style.left = `${x}px`;
      el.innerHTML = `<div class="bgpick-img" style="background-image:url('${opt.thumb}')"></div><div class="bgpick-name">${esc(opt.name)}</div>`;
      el.addEventListener('mouseenter', () => { this.focus = this.tiles.findIndex((t) => t.el === el); this.render(); });
      el.addEventListener('click', () => this.pick());
      this.track.appendChild(el);
      this.tiles.push({ el, opt, x });
      x += TILE_W + TILE_GAP;
    }
  }

  isOpen(): boolean {
    return this.open;
  }

  show(): void {
    const cur = this.current();
    const i = this.tiles.findIndex((t) => t.opt.kind === cur.kind && t.opt.index === cur.index);
    this.focus = Math.max(0, i);
    this.open = true;
    document.documentElement.classList.add('picking');
    this.el.classList.add('open');
    this.render();
  }

  close(): void {
    this.open = false;
    document.documentElement.classList.remove('picking');
    this.el.classList.remove('open');
  }

  handleKey(e: KeyboardEvent): void {
    const k = e.key;
    if (k === 'Escape' || k === 'Backspace') { e.preventDefault(); this.close(); return; }
    if (k === 'Enter' || k === ' ') { e.preventDefault(); this.pick(); return; }
    if (k === 'ArrowLeft') { e.preventDefault(); this.focus = Math.max(0, this.focus - 1); this.render(); }
    else if (k === 'ArrowRight') { e.preventDefault(); this.focus = Math.min(this.tiles.length - 1, this.focus + 1); this.render(); }
    else if (k.startsWith('Arrow')) e.preventDefault();
  }

  private pick(): void {
    const t = this.tiles[this.focus];
    if (!t) return;
    this.choose({ kind: t.opt.kind, index: t.opt.index });
    this.render();
  }

  private render(): void {
    const cur = this.current();
    this.tiles.forEach((t, i) => {
      t.el.classList.toggle('focus', i === this.focus);
      t.el.classList.toggle('chosen', t.opt.kind === cur.kind && t.opt.index === cur.index);
    });
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
