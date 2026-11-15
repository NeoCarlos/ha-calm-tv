/**
 * Demo mode on a phone or tablet: an on-screen remote under (or beside) the TV picture, since the app
 * is driven by a remote's arrows, OK and Back. Each button sends the key press a keyboard would.
 * Shown only on touch screens; with a mouse or keyboard the app works as it is.
 */

const chevron = (rotate: number) =>
  `<svg viewBox="0 0 24 24" style="transform: rotate(${rotate}deg)"><path d="M6 15l6-6 6 6" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

const BUTTONS = [
  { key: 'ArrowUp', cls: 'r-up', label: 'Up', html: chevron(0) },
  { key: 'ArrowRight', cls: 'r-right', label: 'Right', html: chevron(90) },
  { key: 'ArrowDown', cls: 'r-down', label: 'Down', html: chevron(180) },
  { key: 'ArrowLeft', cls: 'r-left', label: 'Left', html: chevron(270) },
  { key: 'Enter', cls: 'r-ok', label: 'OK', html: 'OK' },
];

const press = (key: string) => document.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));

export function showRemote(): void {
  if (!matchMedia('(pointer: coarse)').matches) return;

  const el = document.createElement('div');
  el.className = 'remote';
  el.innerHTML = `
    <div class="remote-pad">
      ${BUTTONS.map((b) => `<button class="${b.cls}" data-key="${b.key}" aria-label="${b.label}">${b.html}</button>`).join('')}
    </div>
    <button class="remote-back" data-key="Escape" aria-label="Back">
      <svg viewBox="0 0 24 24"><path d="M10 6l-6 6 6 6M4 12h11a5 5 0 0 1 0 10h-2" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>
    </button>`;

  // pointerdown rather than click: immediate, and no double-tap zoom or focus ring on the button.
  el.addEventListener('pointerdown', (e) => {
    const button = e.target instanceof Element ? e.target.closest('button') : null;
    const key = button?.dataset.key;

    if (!button || !key) return;
    e.preventDefault();
    button.classList.add('pressed');
    window.setTimeout(() => button.classList.remove('pressed'), 150);
    press(key);
  });

  document.body.appendChild(el);
  document.documentElement.classList.add('with-remote');
}
