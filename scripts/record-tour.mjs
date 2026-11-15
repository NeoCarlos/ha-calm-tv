// Records a captioned tour of demo mode as an MP4: the app opens its made-up home, this script
// presses the remote's keys and shows the captions, and the screen is recorded.
//
//   npm run dev                                              (in another terminal)
//   node scripts/record-tour.mjs out.mp4 [--music song.mp3]  (in a hidden Chrome at 1920×1080)
//   ANDROID_SERIAL=<tv> node scripts/record-tour.mjs out.mp4 --tv
//
// Chrome: smooth enough (about 24 fps) and needs only Chrome and ffmpeg. The dev server address can be
// changed with CT_URL (default http://localhost:5173).
// --tv: on a real TV with the debug app installed (npm run tv:install) and adb connected. The TV's own
// screen recorder only manages about 8 fps at 1080p, so this is for a TV recorded by an HDMI capture
// device instead (the file it saves is then just a reference). The TV goes back to your home after.
// --music: adds a soundtrack, faded in and out to the video's length.
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';

const args = process.argv.slice(2);
const flag = (name) => { const i = args.indexOf(name); return i < 0 ? undefined : args.splice(i, 2)[1]; };
const onTv = args.includes('--tv') && !!args.splice(args.indexOf('--tv'), 1);
const music = flag('--music');
const OUT = args[0] ?? 'calm-tv-tour.mp4';
const CLOCK = '2026-11-14T18:30';
const FPS = 30;

// ---------- a page we can drive: a hidden Chrome, or the TV app over adb ----------

/** A Chrome DevTools connection: call(method, params), plus events. */
async function devtools(wsUrl, onEvent = () => {}) {
  const ws = new WebSocket(wsUrl);
  await new Promise((r) => ws.addEventListener('open', r, { once: true }));
  let id = 0;
  const pending = new Map();
  ws.addEventListener('message', (e) => {
    const m = JSON.parse(e.data);

    if (m.id && pending.has(m.id)) { pending.get(m.id)(m.result); pending.delete(m.id); }
    else if (m.method) onEvent(m, ws);
  });
  const call = (method, params = {}) => new Promise((r) => { const n = ++id; pending.set(n, r); ws.send(JSON.stringify({ id: n, method, params })); });

  return { call, close: () => ws.close(), send: (m) => ws.send(JSON.stringify({ id: ++id, ...m })) };
}

async function chromeDriver() {
  const BASE = process.env.CT_URL ?? 'http://localhost:5173';
  const dir = mkdtempSync(join(tmpdir(), 'calm-tv-tour-'));
  const chrome = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', [
    '--headless=new', '--remote-debugging-port=9557', '--hide-scrollbars', '--autoplay-policy=no-user-gesture-required',
    `--user-data-dir=${join(dir, 'profile')}`, '--window-size=1920,1080', 'about:blank',
  ], { stdio: 'ignore' });
  let targets = [];

  for (let i = 0; i < 40 && !targets.length; i++) {
    await sleep(250);
    targets = await fetch('http://127.0.0.1:9557/json').then((r) => r.json()).catch(() => []);
  }

  // Frames are written to disk as they arrive, timed by arrival (a long tour is thousands of them).
  const frames = [];
  let recording = false;
  const save = (data) => {
    const file = join(dir, `f${String(frames.length).padStart(5, '0')}.jpg`);
    writeFileSync(file, Buffer.from(data, 'base64'));
    frames.push({ file, t: performance.now() / 1000 });
  };
  const dt = await devtools(targets.find((t) => t.type === 'page').webSocketDebuggerUrl, (m, ws) => {
    if (m.method !== 'Page.screencastFrame') return;

    if (recording) save(m.params.data);
    ws.send(JSON.stringify({ id: 1e9 + frames.length, method: 'Page.screencastFrameAck', params: { sessionId: m.params.sessionId } }));
  });
  const { call } = dt;
  const KEYS = { up: ['ArrowUp', 38], down: ['ArrowDown', 40], left: ['ArrowLeft', 37], right: ['ArrowRight', 39], ok: ['Enter', 13], back: ['Escape', 27] };
  // Chrome only sends a frame when the screen changes: a still at each end keeps the pauses there.
  const still = async () => save((await call('Page.captureScreenshot', { format: 'jpeg', quality: 90 })).data);

  return {
    async open() {
      await call('Page.enable');
      await call('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });
      await call('Page.navigate', { url: `${BASE}/?demo&at=${CLOCK}` });
      await sleep(10000); // the video is loaded and the keyboard hint has faded
    },
    async key(name) {
      const [key, code] = KEYS[name];
      await call('Input.dispatchKeyEvent', { type: 'keyDown', key, code: key, windowsVirtualKeyCode: code });
      await call('Input.dispatchKeyEvent', { type: 'keyUp', key, code: key, windowsVirtualKeyCode: code });
    },
    async page(expression) {
      return (await call('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }))?.result?.value;
    },
    async start() {
      await call('Page.startScreencast', { format: 'jpeg', quality: 90, maxWidth: 1920, maxHeight: 1080, everyNthFrame: 1 });
      await sleep(300);
      await still();
      recording = true;
    },
    async stop(out) {
      recording = false;
      await still();
      await call('Page.stopScreencast');
      dt.close();
      chrome.kill();
      // Real frame times → constant 30 fps (each frame held until the next one arrived).
      const list = ['ffconcat version 1.0'];
      frames.forEach((f, i) => {
        list.push(`file ${f.file}`);
        list.push(`duration ${(i < frames.length - 1 ? frames[i + 1].t - f.t : 1 / FPS).toFixed(4)}`);
      });
      writeFileSync(join(dir, 'list.txt'), list.join('\n'));
      const span = frames.at(-1).t - frames[0].t;
      console.log(`${frames.length} frames over ${span.toFixed(1)} s (${(frames.length / span).toFixed(1)} fps captured)`);
      execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', join(dir, 'list.txt'),
        '-vf', `fps=${FPS},format=yuv420p`, '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-movflags', '+faststart', out]);
      rmSync(dir, { recursive: true, force: true });
    },
  };
}

async function tvDriver() {
  const APP = 'io.github.neocarlos.hacalmtv';
  const ON_TV = '/sdcard/calm-tv-tour.mp4';
  const PORT = 9334;
  const adb = (...a) => execFileSync('adb', a, { encoding: 'utf8' }).trim();
  const KEYS = { up: 'DPAD_UP', down: 'DPAD_DOWN', left: 'DPAD_LEFT', right: 'DPAD_RIGHT', ok: 'DPAD_CENTER', back: 'BACK' };
  let recorder = null;

  const page = async (expression) => {
    const targets = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json();
    const dt = await devtools(targets.find((t) => t.url.includes('index.html')).webSocketDebuggerUrl);
    const r = await dt.call('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    dt.close();

    return r?.result?.value;
  };

  return {
    page,
    async open() {
      adb('shell', 'am', 'start', '-n', `${APP}/.MainActivity`, '--es', 'demo', `at=${CLOCK}`);
      await sleep(2500);
      adb('forward', `tcp:${PORT}`, `localabstract:webview_devtools_remote_${adb('shell', 'pidof', APP)}`);
      // Start from the demo's defaults: the first video background, nothing chosen.
      await page(`localStorage.removeItem('calmtv.demo'); localStorage.removeItem('calmtv.demo.look'); location.reload(); true`).catch(() => {});
      await sleep(11000);
    },
    async key(name) {
      adb('shell', 'input', 'keyevent', `KEYCODE_${KEYS[name]}`);
    },
    async start() {
      adb('shell', 'rm', '-f', ON_TV);
      recorder = spawn('adb', ['shell', 'screenrecord', '--bit-rate', '24000000', '--time-limit', '180', ON_TV], { stdio: 'ignore' });
      await sleep(1500);
    },
    async stop(out) {
      // Ctrl-C to screenrecord finishes the file; then fetch it and go back to your own home.
      adb('shell', 'pkill', '-INT', 'screenrecord');
      await new Promise((r) => recorder.on('exit', r));
      await sleep(1500);
      adb('pull', ON_TV, out);
      adb('shell', 'rm', '-f', ON_TV);
      adb('forward', '--remove', `tcp:${PORT}`);
      adb('shell', 'am', 'start', '-n', `${APP}/.MainActivity`, '--es', 'demo', 'off');
    },
  };
}

// ---------- the tour ----------

async function tour(d) {
  const key = async (name, pause = 700) => { await d.key(name); await sleep(pause); };
  const keys = async (name, times, pause) => { for (let i = 0; i < times; i++) await key(name, pause); };
  const caption = (title, detail = '') => d.page(`ctDemo.caption(${JSON.stringify(title)}, ${JSON.stringify(detail)})`);

  // Apps
  await caption('HA Calm TV', 'A calm Google TV home screen, driven by Home Assistant');
  await sleep(2500);
  await keys('right', 3, 600);
  await keys('left', 3, 500);
  await sleep(800);

  // Smart Home: rooms and a light
  await caption('Every room at a glance', 'Lights, curtains, locks and sensors, with the remote');
  await key('down', 1800);
  await key('right', 700); await key('right', 700); await key('left', 700); await key('left', 900);
  await key('ok', 1400);
  await key('down', 700);
  await key('ok', 900);
  await keys('right', 5, 380);
  await sleep(900);
  await key('back', 1100);
  await key('back', 2000);

  // Thermostat and a scene
  await caption('Thermostat and scenes');
  await key('right', 900);
  await key('ok', 1300);
  await key('ok', 900);
  await key('up', 600); await key('up', 1300);
  await key('back', 900);
  await key('back', 1100);
  await key('right', 900);
  await key('ok', 1300);
  await key('ok', 900);
  await key('down', 500); await key('down', 700);
  await key('ok', 1300);
  await key('back', 1500);

  // Cameras
  await caption('Live cameras', 'Played through Home Assistant, like its own dashboard');
  await keys('right', 3, 450);
  await sleep(500);
  await key('ok', 1300);
  await key('right', 600); await key('right', 900);
  await key('ok', 4500);
  await key('back', 1000);
  await key('back', 1500);

  // Doorbell
  await caption('Doorbell alerts', 'A live view in the corner, even over other apps');
  await d.page('ctDemo.ring()');
  await sleep(6500);
  await key('back', 1500);

  // Calendar
  await caption('Your calendar', 'Tonight’s dinner and the next two weeks');
  await key('down', 2600);
  await keys('right', 5, 950);
  await sleep(900);

  // Weather
  await caption('Weather', 'The week, hour by hour');
  await key('down', 2600);
  await keys('right', 4, 1150);
  await sleep(900);

  // Backgrounds
  await caption('Your own photos or looping videos');
  await keys('up', 3, 500);
  await sleep(600);
  await keys('right', 6, 220);
  await sleep(700);
  await key('ok', 1300);
  await key('ok', 1500);
  await key('right', 900);
  await key('ok', 4000);
  await key('back', 900);
  await key('back', 1800);

  // Outro
  await caption('github.com/NeoCarlos/ha-calm-tv', 'Open source · MIT licence');
  await sleep(5000);
  await caption('');
  await sleep(1200);
}

/** Adds the soundtrack: a short fade in, and a fade out over the last 4 seconds. */
function addMusic(video, song) {
  const length = Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', video], { encoding: 'utf8' }));
  const tmp = `${video}.music.mp4`;
  execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-i', video, '-i', song,
    '-af', `afade=t=in:d=1.5,afade=t=out:st=${(length - 4).toFixed(2)}:d=4`, '-map', '0:v', '-map', '1:a',
    '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-t', length.toFixed(2), '-movflags', '+faststart', tmp]);
  execFileSync('mv', [tmp, video]);
}

const driver = onTv ? await tvDriver() : await chromeDriver();
await driver.open();
await driver.start();

try {
  await tour(driver);
} finally {
  await driver.stop(OUT);
}

if (music) addMusic(OUT, music);
console.log(`Saved ${OUT}`);
