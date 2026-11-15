import { apps } from '../apps';
import type { App } from '../types';
import type { Section } from './section';

// Icon-only tiles; the label appears only for the focused app.
const TW = 150;
const TH = 104;
const PITCH = 160;
const GAP = PITCH - TW;
const SHELF_W = 1472;
const DOCK_H = 128;

/** Section 0: the clock + app dock (CleanFrame-style). */
export class AppsSection implements Section {
  readonly el: HTMLElement;
  private tiles: HTMLElement[] = [];
  private track!: HTMLElement;
  private shelf!: HTMLElement;
  private clockEl!: HTMLElement;
  private dateEl!: HTMLElement;
  private first = 0;

  constructor(private secIndex: number, private onLaunch: (a: App) => void) {
    this.el = this.build();
    this.tick();
    setInterval(() => this.tick(), 1000);
  }

  private build(): HTMLElement {
    const s = document.createElement('section');
    s.className = 'section';
    s.id = 'secApps';
    s.innerHTML = `
      <div class="caption"><p class="clock" id="clock">—</p><p class="cdate" id="cdate">—</p></div>
      <div class="gb" id="dock">
        <div class="gb-mat"><div class="gb-img"></div><div class="gb-veil"></div></div>
        <div class="gb-edge"></div>
        <div class="gb-shelf"><div class="gb-track"></div></div>
      </div>`;
    this.track = s.querySelector('.gb-track') as HTMLElement;
    this.shelf = s.querySelector('.gb-shelf') as HTMLElement;
    this.clockEl = s.querySelector('#clock') as HTMLElement;
    this.dateEl = s.querySelector('#cdate') as HTMLElement;

    const top = (DOCK_H - TH) / 2;
    apps.forEach((a, i) => {
      const t = document.createElement('div');
      t.className = 'tile';
      t.dataset.sec = String(this.secIndex);
      t.dataset.item = String(i);
      t.style.width = `${TW}px`;
      t.style.height = `${TH}px`;
      t.style.left = `${i * PITCH}px`;
      t.style.top = `${top}px`;
      t.innerHTML = `<div class="plate"></div><div class="tc"><div class="mark">${a.mark}</div></div>`;
      this.track.appendChild(t);
      this.tiles.push(t);
    });

    return s;
  }

  count(): number {
    return this.tiles.length;
  }

  focus(i: number): void {
    this.tiles.forEach((t) => t.classList.remove('is-focus'));
    const n = this.tiles.length;
    const visible = Math.floor((SHELF_W + GAP) / PITCH);
    let tx: number;

    if (n <= visible) {
      // everything fits: center the row, no scrolling
      const content = n * PITCH - GAP;
      tx = (SHELF_W - content) / 2;
      this.first = 0;
      this.shelf.classList.remove('fade-r', 'fade-lr');
    } else {
      if (i < this.first) this.first = i;

      if (i > this.first + visible - 1) this.first = i - visible + 1;
      this.first = Math.max(0, Math.min(this.first, n - visible));
      tx = -this.first * PITCH;
      const canLeft = this.first > 0;
      const canRight = this.first + visible < n;
      this.shelf.classList.remove('fade-r', 'fade-lr');

      if (canLeft && canRight) this.shelf.classList.add('fade-lr');
      else if (canRight) this.shelf.classList.add('fade-r');
    }

    this.track.style.transform = `translateX(${tx}px)`;
    this.tiles[i]?.classList.add('is-focus');
  }

  blur(): void {
    this.tiles.forEach((t) => t.classList.remove('is-focus'));
  }

  activate(i: number): void {
    const a = apps[i];

    if (a) this.onLaunch(a);
  }

  private tick(): void {
    const d = new Date();
    const h = d.getHours();
    const m = d.getMinutes();
    const mm = (m < 10 ? '0' : '') + m;
    this.clockEl.textContent = `${h % 12 || 12}:${mm}`;
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    const mon = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December',
    ];

    this.dateEl.textContent = `${days[d.getDay()]}, ${mon[d.getMonth()]} ${d.getDate()}`;
  }
}
