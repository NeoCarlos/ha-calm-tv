import { saveHaUrl, settings } from './config';

/** Set by the setup screen: open Home Assistant's sign-in as soon as the page has reloaded. */
export const SIGN_IN_NEXT = 'ct.signInNext';

/**
 * The one-time "Connect to Home Assistant" screen: asks for Home Assistant's address (typed with
 * the remote's on-screen keyboard) and reloads with it. Shown at start when no address is saved,
 * and from Settings to change it. On the TV it can also be set without typing:
 *   adb shell am start -n io.github.neocarlos.hacalmtv/.MainActivity --es haUrl http://192.168.1.20:8123
 */
export function showSetup(opts: { canCancel: boolean }): void {
  if (document.querySelector('.setup')) return;
  const el = document.createElement('div');
  el.className = 'setup';
  el.innerHTML = `
    <div class="setup-card">
      <div class="setup-title">Connect to Home Assistant</div>
      <div class="setup-text">Type your Home Assistant address, as this TV can reach it, then press OK.</div>
      <input class="setup-input" type="url" inputmode="url" autocomplete="off" autocapitalize="off" spellcheck="false"
        placeholder="http://192.168.1.20:8123" />
      <div class="setup-msg"></div>
      <div class="setup-hint">${opts.canCancel ? 'Back to cancel · ' : ''}Calm TV then loads calm-tv.json from Home Assistant's www folder.</div>
    </div>`;
  (document.querySelector('#stage') ?? document.body).appendChild(el);
  const input = el.querySelector('input') as HTMLInputElement;
  const msg = el.querySelector('.setup-msg') as HTMLElement;
  input.value = settings.haUrl || 'http://';

  const close = () => {
    document.removeEventListener('keydown', onKey, true);
    el.remove();
  };

  // Capture phase: the screens behind never see these keys while this is open.
  const onKey = (e: KeyboardEvent) => {
    e.stopPropagation();

    if (e.key === 'Enter') {
      e.preventDefault();
      const url = saveHaUrl(input.value);

      if (!url) {
        msg.textContent = 'That doesn’t look like an address. Example: http://192.168.1.20:8123';

        return;
      }

      msg.textContent = `Saved ${url} · opening Home Assistant’s sign-in…`;

      // Straight on to signing in after the reload, so setup is one step.
      try { sessionStorage.setItem(SIGN_IN_NEXT, '1'); } catch { /* storage off: sign in from Settings */ }

      location.reload();
    } else if ((e.key === 'Escape' || (e.key === 'Backspace' && !input.value)) && opts.canCancel) {
      e.preventDefault();
      close();
    }
  };

  document.addEventListener('keydown', onKey, true);
  input.focus();
  input.setSelectionRange(input.value.length, input.value.length);
}
