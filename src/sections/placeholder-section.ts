import type { Section } from './section';

/** A minimal stub section (Calendar, Weather) — built out later. */
export class PlaceholderSection implements Section {
  readonly el: HTMLElement;

  constructor(id: string, title: string, subtitle: string) {
    const s = document.createElement('section');
    s.className = 'section placeholder';
    s.id = id;
    s.innerHTML = `<div class="ph"><div class="ph-title">${title}</div><div class="ph-sub">${subtitle}</div></div>`;
    this.el = s;
  }

  count(): number {
    return 0;
  }
  focus(): void {}
  blur(): void {}
  activate(): void {}
}
