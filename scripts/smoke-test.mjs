// Drives the app in demo mode the two ways it's used, and fails if either stops working:
//
//   - with the remote (arrow keys, OK and Back), as on the TV: index.html?demo
//   - with taps, as on the Home Assistant dashboard: index.html?demo&dash
//
// Each panel is opened, used and closed both ways, and in every open panel all its items must be
// reachable with the arrows (see focus.ts). Runs on every pull request (.github/workflows/test.yml).
//
//   npm test                       (needs Google Chrome; CHROME_PATH to point at another copy)
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'vite';

const CHROME = process.env.CHROME_PATH
  ?? ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium']
    .find((p) => existsSync(p));
const KEYS = { ArrowLeft: 37, ArrowUp: 38, ArrowRight: 39, ArrowDown: 40, Enter: 13, Escape: 27 };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

if (!CHROME) throw new Error('Google Chrome not found; set CHROME_PATH');

const server = await createServer({ server: { port: 0, host: '127.0.0.1', strictPort: false }, logLevel: 'error' });
await server.listen();
const base = server.resolvedUrls.local[0];
const profile = mkdtempSync(join(tmpdir(), 'calm-tv-test-'));
const chrome = spawn(CHROME, ['--headless=new', '--no-sandbox', '--remote-debugging-port=9557', '--hide-scrollbars', `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' });
let failures = 0;

try {
  let targets = [];

  for (let i = 0; i < 60 && !targets.length; i++) {
    await sleep(250);
    targets = await fetch('http://127.0.0.1:9557/json').then((r) => r.json()).catch(() => []);
  }

  const ws = new WebSocket(targets.find((t) => t.type === 'page').webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener('open', r, { once: true }));
  let id = 0;
  const pending = new Map();
  const errors = [];

  ws.addEventListener('message', (e) => {
    const m = JSON.parse(e.data);

    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }

    if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails.exception?.description ?? m.params.exceptionDetails.text);

    if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') errors.push(m.params.args.map((a) => a.value ?? a.description).join(' '));
  });

  const call = (method, params = {}) => new Promise((r) => { const n = ++id; pending.set(n, r); ws.send(JSON.stringify({ id: n, method, params })); });

  /** Runs `fn` (source of an expression or async function body) in the page; returns its value. */
  async function page(expression) {
    const m = await call('Runtime.evaluate', { expression: `(async () => { ${expression} })()`, awaitPromise: true, returnByValue: true });

    if (m.result?.exceptionDetails) throw new Error(m.result.exceptionDetails.exception?.description ?? 'page error');

    return m.result?.result?.value;
  }

  /** A press on the remote; `held` sends it as the repeat of a held key. */
  const key = async (k, held = false) => {
    const p = { key: k, code: k, windowsVirtualKeyCode: KEYS[k] };
    await call('Input.dispatchKeyEvent', { type: 'keyDown', autoRepeat: held, ...p });
    await call('Input.dispatchKeyEvent', { type: 'keyUp', ...p });
    await sleep(120);
  };

  /** Taps the first visible element matching `selector`: its centre, or near its top-left corner with `corner`. */
  const tap = async (selector, corner = false) => {
    const at = await page(`const el = [...document.querySelectorAll(${JSON.stringify(selector)})].find((e) => e.getClientRects().length);
      if (!el) return null; const r = el.getBoundingClientRect();
      return ${corner} ? { x: r.x + 12, y: r.y + 12 } : { x: r.x + r.width / 2, y: r.y + r.height / 2 };`);

    if (!at) throw new Error(`nothing to tap: ${selector}`);

    for (const type of ['mousePressed', 'mouseReleased']) await call('Input.dispatchMouseEvent', { type, x: at.x, y: at.y, button: 'left', clickCount: 1 });
    await sleep(250);
  };

  /** A swipe with a finger, from (x, y) by (dx, dy). */
  const swipe = async (x, y, dx, dy) => {
    await call('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
    await call('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x + dx / 2, y: y + dy / 2 }] });
    await call('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x + dx, y: y + dy }] });
    await call('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await sleep(300);
  };

  const text = (selector) => page(`return document.querySelector(${JSON.stringify(selector)})?.textContent?.trim() ?? null;`);
  const has = (selector) => page(`return [...document.querySelectorAll(${JSON.stringify(selector)})].some((e) => e.getClientRects().length > 0);`);

  let mode = '';

  const check = (ok, what) => {
    console.log(`${ok ? '  ok  ' : '  FAIL'} ${mode}: ${what}`);

    if (!ok) failures++;
  };

  /**
   * In the open panel `root`, every item must be reachable with the arrows from the focused one
   * (by the same rules as focus.ts), so nothing can be tapped that the remote can't reach.
   */
  const reachable = (root) => page(`
    const { nearest } = await import('/src/focus.ts');
    const items = [...document.querySelectorAll(${JSON.stringify(root)} + ' [data-focus]')]
      .filter((e) => e.getAttribute('aria-disabled') !== 'true' && e.getClientRects().length > 0);
    const start = items.find((e) => e.classList.contains('focus')) ?? items[0];
    if (!start) return { total: 0, missing: ['(no items)'] };
    const seen = new Set([start]); const queue = [start];
    while (queue.length) {
      const from = queue.shift();
      for (const dir of ['up', 'down', 'left', 'right']) {
        const next = nearest(from, items.filter((i) => i !== from), dir);
        if (next && !seen.has(next)) { seen.add(next); queue.push(next); }
      }
    }
    return { total: items.length, missing: items.filter((i) => !seen.has(i)).map((i) => i.dataset.focus) };`);

  const allReachable = async (root, name) => {
    const r = await reachable(root);
    check(r.total > 0 && r.missing.length === 0, `${name}: all ${r.total} items reachable with the arrows${r.missing.length ? ` (not: ${r.missing.join(', ')})` : ''}`);
  };

  const open = async (query, width, height, touch = false) => {
    await call('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
    await call('Emulation.setTouchEmulationEnabled', { enabled: touch, maxTouchPoints: touch ? 5 : 0 });
    await call('Page.navigate', { url: `${base}?${query}&at=2026-11-14T18:30` });
    await sleep(3500);
  };

  await call('Page.enable');
  await call('Runtime.enable');

  // ---------- the TV: remote only ----------
  mode = 'remote';
  await open('demo', 1920, 1080);
  check(await has('#secApps.is-active'), 'starts on the Apps screen');
  await key('ArrowDown');
  check(await has('#secHome.is-active'), '↓ goes to Smart Home');

  await key('Enter');
  check(await has('.detail.open:not(.settings)'), 'OK opens a room');
  await allReachable('.detail.open:not(.settings) .detail-panel', 'room');
  await key('Enter');
  check(await has('.detail-control.open .ctl-light'), 'OK on a dimmer opens it');
  const before = await text('.ctl-state');
  await key('ArrowLeft');
  check((await text('.ctl-state')) !== before, `← dims it (${before} → ${await text('.ctl-state')})`);
  await key('Escape');
  check(!(await has('.detail-control.open')), 'Back closes the dimmer');
  await key('Escape');
  check(!(await has('.detail.open')), 'Back closes the room');

  await key('ArrowRight');
  await key('Enter');
  await key('Enter');
  const temp = await text('.ctl-set');
  await key('ArrowUp');
  check(Number(await text('.ctl-set')) === Number(temp) + 1, `↑ raises the thermostat (${temp} → ${await text('.ctl-set')})`);
  await key('Escape');
  await key('Escape');

  await key('ArrowRight');
  await key('Enter');
  await key('Enter');
  check(await has('.detail-control.open .scene-opt'), 'OK on a scene opens the list');
  await allReachable('.detail-control.open', 'scene list');
  await key('ArrowDown');
  const scene = await text('.scene-opt.focus');
  await key('Enter');
  check(!(await has('.detail-control.open')) && (await text('.detail.open .drow .dstatus')) === scene, `OK sets the scene (${scene})`);
  await key('Escape');

  await key('ArrowUp');
  // Held, → stops at the end of the dock (pressed one at a time it wraps round): the gear.
  for (let i = 0; i < 14; i++) await key('ArrowRight', true);
  await key('Enter');
  await sleep(500);
  check(await has('.settings.open'), 'OK on the gear opens Settings');
  await allReachable('.settings.open', 'Settings');
  // Appearance: the background, the Music background and the look choices, in one sub-menu.
  await key('Enter');
  check((await text('.settings .detail-title')) === 'Appearance', 'OK opens a Settings sub-menu (Appearance)');
  await allReachable('.settings.open', 'Appearance');
  await key('Escape');
  check((await text('.settings .detail-title')) === 'Settings', 'Back returns to Settings');
  await key('Enter');
  // Music background: OK steps to the next choice, and the Music screen follows.
  const mbRow = await page("return [...document.querySelectorAll('.settings .drow')].findIndex((r) => r.querySelector('.dname')?.textContent === 'Music background');");
  await page(`document.querySelectorAll('.settings .drow')[${mbRow}].click();`);
  check((await page("return document.querySelector('#secMusic').dataset.glow;")) === 'glow', 'Settings → Appearance → Music background steps from None to Glow');
  await page(`document.querySelectorAll('.settings .drow')[${mbRow}].click(); document.querySelectorAll('.settings .drow')[${mbRow}].click(); document.querySelectorAll('.settings .drow')[${mbRow}].click();`);
  check((await page("return document.querySelector('#secMusic').dataset.glow;")) === 'none', '…and round again to None');
  const waveRow = await page("return [...document.querySelectorAll('.settings .drow')].findIndex((r) => r.querySelector('.dname')?.textContent === 'Music wave');");
  const waveOn = await page("return document.querySelector('#secMusic').dataset.wave;");
  await page(`document.querySelectorAll('.settings .drow')[${waveRow}].click();`);
  const waveOff = await page("return document.querySelector('#secMusic').dataset.wave;");
  await page(`document.querySelectorAll('.settings .drow')[${waveRow}].click();`);
  check(waveOn === 'on' && waveOff === 'off' && (await page("return document.querySelector('#secMusic').dataset.wave;")) === 'on', 'Music wave is on by default, and OK turns it off and on');
  const fxRow = await page("return [...document.querySelectorAll('.settings .drow')].findIndex((r) => r.querySelector('.dname')?.textContent === 'Visual effects');");
  const fx = () => page(`return document.querySelectorAll('.settings .drow')[${fxRow}].querySelector('.dstatus').textContent;`);
  const fxBefore = await fx();
  await page(`document.querySelectorAll('.settings .drow')[${fxRow}].click();`);
  const fxOff = await fx();
  await page(`document.querySelectorAll('.settings .drow')[${fxRow}].click();`);
  check(fxBefore.startsWith('On') && fxOff.startsWith('Off') && (await fx()).startsWith('On'), `Visual effects switches glass and fades together (${fxOff.split(' · ')[1]})`);
  // Up from Visual effects to Background, the first row.
  for (let i = 0; i < 4; i++) await key('ArrowUp');
  await key('Enter');
  check(await has('.bgpick.open'), 'Background opens the picker');
  await allReachable('.bgpick.open', 'background picker');
  await key('Escape');
  check(!(await has('.bgpick.open')), 'Back closes the picker');

  check(!(await page("return [...document.querySelectorAll('#secApps .tile')].some((t) => /music/i.test(t.getAttribute('aria-label') ?? ''));")), 'the dock has no Music tile');

  // The Music screen: the art and the main controls; More opens the Music panel.
  await key('ArrowDown');
  await key('ArrowDown');
  check(await has('#secMusic.is-active') && await has('#secMusic .mx-art img'), 'the Music screen shows the album art');
  const playLabel = () => page("return document.querySelector('#secMusic .mxb.is-focus')?.getAttribute('aria-label');");
  const wasLabel = await playLabel();
  await key('Enter');
  check(wasLabel === 'Pause' && (await playLabel()) === 'Play', `OK on play/pause pauses (${wasLabel} → ${await playLabel()})`);
  await key('Enter');
  await page("document.querySelector('#secMusic').classList.add('calm');");
  await key('Enter');
  check(!(await has('#secMusic.calm')) && (await playLabel()) === 'Pause', 'when the bar has faded, OK only brings it back');
  for (let i = 0; i < 4; i++) await key('ArrowRight');
  await key('Enter');
  check(await has('.music.open'), 'More opens the Music panel');
  await allReachable('.music.open', 'Music');
  // → along a row of buttons goes to the next one, not diagonally to a closer one on the staggered row below.
  await page("document.querySelector('.music [data-focus=\"library-0\"]').dispatchEvent(new PointerEvent('pointerover', { pointerType: 'mouse', bubbles: true }));");
  await key('ArrowRight');
  check((await page("return document.querySelector('.music .focus')?.dataset.focus;")) === 'library-1', 'Music library: → from Artists goes to Albums, the next one in its row');
  await page("document.querySelector('.music [data-focus=\"speaker-0\"]').dispatchEvent(new PointerEvent('pointerover', { pointerType: 'mouse', bubbles: true }));");
  await key('ArrowDown');
  await key('ArrowDown');
  await key('ArrowRight');
  await key('ArrowRight');
  await key('ArrowRight');
  await key('Enter');
  await sleep(300);
  check(await has('.music.browsing .mcard'), 'OK on a library button opens it');
  await allReachable('.music.open', 'Music folder');
  await key('Escape');
  check(!(await has('.music.browsing')), 'Back leaves the folder');
  await key('Escape');
  check(!(await has('.music.open')) && await has('#secMusic.is-active'), 'Back closes the panel, back on the Music screen');

  // ---------- the Home Assistant dashboard: taps only ----------
  mode = 'touch';
  await open('demo&dash', 1280, 800, true);
  check(await has('#dashboardBar') && await has('#secHome.is-active'), 'starts on Home, with the tab bar');
  await tap('#dashboardBar .tb-tab:nth-child(3)');
  check(await has('#secCalendar.is-active'), 'the Calendar tab shows Calendar');
  await swipe(640, 300, 0, 200);
  check(await has('#secMusic.is-active'), 'swiping down goes back a screen (Music)');
  await tap('#dashboardBar .tb-tab:nth-child(1)');

  await tap('#secHome [data-item="0"]');
  check(await has('.detail.open:not(.settings)'), 'tapping a room opens it');
  await tap('.detail.open [data-focus="device-0-0"]');
  check(await has('.detail-control.open .ctl-light'), 'tapping a dimmer opens it');
  await tap('.ctl-light .ctl-name');
  check((await text('.ctl-state')) === 'Off', 'tapping its name switches it off');
  await tap('.detail-control', true);
  check(!(await has('.detail-control.open')), 'tapping outside closes the dimmer');
  await tap('.detail.open .detail-close');
  check(!(await has('.detail.open')), 'the close button closes the room');

  await tap('#secHome [data-item="1"]');
  await tap('.detail.open [data-focus="device-0-0"]');
  const t0 = await text('.ctl-set');
  await tap('.ctl-step[data-step="1"]');
  check(Number(await text('.ctl-set')) === Number(t0) + 1, `+ raises the thermostat (${t0} → ${await text('.ctl-set')})`);
  await tap('.detail-control', true);
  await tap('.detail.open .detail-close');

  // Rows are grabbed and dragged like any touch list (row-scroll.ts), not stepped one card per swipe.
  const rowLeft = () => page("return Math.round(document.querySelector('#secHome .touch-row').scrollLeft);");
  const row = await page("const r = document.querySelector('#secHome .touch-row').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 };");
  // A finger moving in small steps, as on a real screen (Chrome on Linux ignores synthesizeScrollGesture).
  await call('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: row.x, y: row.y }] });

  for (let i = 1; i <= 15; i++) {
    await call('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: row.x - i * 20, y: row.y }] });
    await sleep(16);
  }

  await call('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await sleep(800);
  const dragged = await rowLeft();
  const why = dragged > 100 ? '' : await page(`const s = document.querySelector('#secHome .touch-row');
    const at = document.elementFromPoint(${row.x}, ${row.y});
    return '; scrollWidth ' + s.scrollWidth + ', clientWidth ' + s.clientWidth + ', under the finger: ' + (at ? at.tagName + '.' + at.className : 'nothing')
      + ', touch points ' + navigator.maxTouchPoints;`);
  check(dragged > 100, `dragging the rooms scrolls them (${dragged}px${why})`);
  check(await has('#secHome.is-active'), 'a sideways drag doesn’t change screens');

  // Tapping a card that the drag brought into view must not snap the row back (only if the drag worked).
  if (dragged > 100) {
    await tap('#secHome [data-item="4"]');
    await tap('.detail.open .detail-close');
    check(Math.abs((await rowLeft()) - dragged) < 200, `tapping a card doesn’t snap the row back (${dragged} → ${await rowLeft()}px)`);
  }
  await swipe(row.x, row.y, 0, -200);
  check(await has('#secMusic.is-active'), 'swiping up on the rooms still changes screens');
  await tap('#dashboardBar .tb-tab:nth-child(1)');

  await tap('#dashboardBar .tb-tab:nth-child(2)');
  check(await has('#secMusic.is-active'), 'the Music tab shows the Music screen');
  await tap('#secMusic .mxb.more');
  check(await has('.music.open'), 'tapping More opens the Music panel');
  await tap('.music .mcat:nth-child(4)');
  await sleep(300);
  check(await has('.music.browsing .mcard'), 'tapping a library button opens it');
  await tap('.music-grid .mcard');
  await sleep(300);
  check(await has('.music.browsing .mcard'), 'tapping a playlist opens it');
  await tap('#dashboardBar .tb-tab:nth-child(4)');
  check(!(await has('.music.open')) && await has('#secWeather.is-active'), 'a screen tab closes Music and shows that screen');
  await tap('#secWeather [data-item="0"]');
  await tap('#dashboardBar .tb-tab:nth-child(1)');
  check(await has('#secHome.is-active'), 'the Home tab goes back to Home');
  await tap('#secHome [data-item="0"]');
  await tap('#dashboardBar .tb-tab:nth-child(1)');
  check(!(await has('.detail.open')), 'the tab of the screen on show closes a room on top of it');
  await tap('#dashboardBar .tb-tab:nth-child(2)');
  await tap('#secMusic .mxb.more');
  await tap('.music .mcat:nth-child(4)');
  await sleep(300);
  await tap('.music-grid .mcard');
  await sleep(300);
  await tap('.music-hint');
  await tap('.music-hint');
  await tap('.music-hint');
  check(!(await has('.music.open')), 'the Back and Close button closes Music');

  await tap('#dashboardBar .tb-icon');
  check(await has('.settings.open'), 'the gear opens Settings');
  check(!(await page("return [...document.querySelectorAll('.settings .dname')].some((e) => e.textContent === 'TV settings');")), 'Settings leaves out the TV-only rows');
  await tap('.settings .drow');
  check((await text('.settings .detail-title')) === 'Appearance', 'tapping Appearance opens it');
  await tap('.settings .drow');
  check(await has('.bgpick.open'), 'tapping Background opens the picker');
  await tap('.bgpick-done');
  check(!(await has('.bgpick.open')), 'Done closes the picker');

  check(errors.length === 0, `no errors in the page${errors.length ? `: ${errors.slice(0, 3).join(' | ')}` : ''}`);
  ws.close();
} finally {
  // Wait for Chrome to exit before removing its profile; a leftover temp folder must never fail the run.
  const exited = new Promise((r) => chrome.once('exit', r));
  chrome.kill();
  await Promise.race([exited, sleep(5000)]);
  await server.close();

  try {
    rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  } catch {
    console.warn(`(couldn't remove ${profile})`);
  }
}

console.log(failures ? `\n${failures} check(s) failed.` : '\nAll checks passed.');
process.exit(failures ? 1 : 0);
