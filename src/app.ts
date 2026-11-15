import { wallpapers } from './wallpapers';
import { videos } from './videos';
import { settings } from './config';
import { load, save } from './state';
import { AppsSection } from './sections/apps-section';
import { SmartHomeSection } from './sections/smarthome-section';
import { CalendarSection } from './sections/calendar-section';
import { WeatherSection } from './sections/weather-section';
import { ZoneDetail } from './sections/zone-detail';
import { SettingsPanel, type BackgroundControls } from './sections/settings-panel';
import { BackgroundPicker, type BgChoice } from './sections/background-picker';
import type { Section } from './sections/section';
import type { App } from './types';
import { native } from './native';
import { ha, type ForecastEntry } from './ha';
import { applyStates, WEATHER } from './home-data';
import { conditionLabel } from './sections/weather-section';
import type { Connection } from 'home-assistant-js-websocket';
import { DoorbellWindow, doorbellEnabled, doorbellRinging } from './doorbell';

/** calm-tv.json "display": "videos": false hides video backgrounds (on by default). */
const videosAllowed = () => settings.config.display?.videos !== false;

function qs<T extends Element = HTMLElement>(sel: string): T {
  const el = document.querySelector(sel);
  if (!el) throw new Error(`Missing element: ${sel}`);
  return el as unknown as T;
}

export class CalmTv {
  private persist = load();
  private sections: Section[] = [];
  private secIndex = 0;
  private cols: number[] = [];
  private frontA = true;
  private overlay: null | 'launch' = null;
  private launchTimer = 0;
  private hintTimer = 0;
  private readonly reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  private track!: HTMLElement;
  private detail!: ZoneDetail;
  private home!: SmartHomeSection;
  private settings!: SettingsPanel;
  private picker!: BackgroundPicker;
  private doorbell!: DoorbellWindow;

  start(): void {
    this.picker = new BackgroundPicker(
      qs('#stage'),
      [
        ...(videosAllowed() ? videos.map((v, index) => ({ kind: 'video' as const, index, name: v.name, thumb: v.thumb })) : []),
        ...wallpapers.map((w, index) => ({ kind: 'photo' as const, index, name: w.name, thumb: w.url })),
      ],
      () => ({ kind: this.bgMode, index: this.bgMode === 'video' ? this.vid : this.wp }),
      (c) => this.chooseBackground(c),
    );
    const bg: BackgroundControls = {
      mode: () => this.bgMode,
      name: () => (this.bgMode === 'video' ? videos[this.vid]?.name ?? '' : wallpapers[this.wp].name),
      openPicker: () => this.picker.show(),
    };
    this.settings = new SettingsPanel(qs('#stage'), bg);
    const appsSection = new AppsSection(0, (a) => (a.kind === 'settings' ? this.settings.show() : this.openLaunch(a)));
    this.detail = new ZoneDetail(qs('#stage'), () => this.home.refresh());
    this.doorbell = new DoorbellWindow(qs('#stage'), 'Back to dismiss');
    this.home = new SmartHomeSection(1, (z) => this.detail.openZone(z), () => ha.signIn());
    // Cards come and go as the calendar loads: keep focus valid while it's on screen.
    const calendar = new CalendarSection(2, () => { if (this.sections && this.secIndex === 2) this.render(); });
    const weather = new WeatherSection(3);
    this.sections = [appsSection, this.home, calendar, weather];
    this.connectHomeAssistant(weather);
    this.cols = this.sections.map(() => 0);

    this.track = qs('#sectionsTrack');
    this.sections.forEach((s) => this.track.appendChild(s.el));

    this.wireInput();
    this.paintInitial();
    this.fit();
    window.addEventListener('resize', () => this.fit());
    this.render();
    this.hintTimer = window.setTimeout(() => qs('#hint').classList.add('gone'), 6000);
  }

  // ---------- Home Assistant ----------
  private connectHomeAssistant(weather: WeatherSection): void {
    let ringing: boolean | undefined;
    const update = () => {
      // Doorbell: act when "Doorbell ringing" turns on (not if it was already on when we connected).
      // Calm TV's own doorbell window is off unless calm-tv.json turns it on: Google TV
      // already shows its own alert for Nest doorbells.
      const r = ha.entities[doorbellRinging()]?.state === 'on';
      if (doorbellEnabled() && ringing === false && r) this.ring();
      if (ringing && !r) this.doorbell.hide();
      if (ha.status === 'connected' && ha.entities[doorbellRinging()]) ringing = r;
      applyStates(ha.entities);
      const w = ha.entities[WEATHER];
      this.home.setOutside(
        w && typeof w.attributes.temperature === 'number'
          ? { temp: w.attributes.temperature, condition: conditionLabel(w.state) }
          : {},
      );
      weather.setCurrent(w ? { condition: w.state, temperature: w.attributes.temperature as number | undefined } : null);
      this.detail.refresh();
    };
    ha.onEntities(update);
    ha.onStatus(() => {
      this.home.refresh();
      this.settings.refresh();
      // The Smart Home bar swaps between rooms and the sign-in card: keep focus valid.
      if (this.secIndex === 1) this.render();
    });

    // Forecasts aren't entity states; subscribe once per connection (the library resubscribes after a drop).
    const subscribed = new WeakSet<Connection>();
    ha.onConnected((conn) => {
      if (subscribed.has(conn)) return;
      subscribed.add(conn);
      const sub = (forecast_type: 'daily' | 'hourly', fn: (f: ForecastEntry[]) => void) =>
        conn
          .subscribeMessage<{ forecast: ForecastEntry[] | null }>((m) => fn(m.forecast ?? []), {
            type: 'weather/subscribe_forecast',
            entity_id: WEATHER,
            forecast_type,
          })
          .catch((e) => console.warn('Forecast subscribe failed', forecast_type, e));
      sub('daily', (f) => weather.setDaily(f));
      sub('hourly', (f) => weather.setHourly(f));
    });

    // "Left unlocked" depends on time passing, not just on new states.
    window.setInterval(update, 60000);
    ha.start();
  }

  /** Someone rang: video in Calm TV's corner, or over whatever app is on screen. */
  private ring(): void {
    if (native?.isInFront && !native.isInFront() && native.showDoorbell?.()) return;
    this.doorbell.show();
  }

  // ---------- navigation ----------
  private render(): void {
    // Sections cross-fade (see .section.is-active in style.css).
    this.sections.forEach((s, i) => {
      s.el.classList.toggle('is-active', i === this.secIndex);
      if (i !== this.secIndex) s.blur();
    });
    const s = this.sections[this.secIndex];
    const n = s.count();
    if (n > 0) {
      this.cols[this.secIndex] = Math.max(0, Math.min(this.cols[this.secIndex], n - 1));
      s.focus(this.cols[this.secIndex]);
    }
  }

  private moveV(d: number): void {
    const ni = Math.max(0, Math.min(this.secIndex + d, this.sections.length - 1));
    if (ni === this.secIndex) return;
    this.secIndex = ni;
    this.render();
    this.sections[ni].onEnter?.();
    this.hideHint();
  }

  private moveH(d: number): void {
    const s = this.sections[this.secIndex];
    const n = s.count();
    if (n <= 0) return;
    this.cols[this.secIndex] = Math.max(0, Math.min(this.cols[this.secIndex] + d, n - 1));
    s.focus(this.cols[this.secIndex]);
    this.hideHint();
  }

  private activate(): void {
    const s = this.sections[this.secIndex];
    if (s.count() > 0) s.activate(this.cols[this.secIndex]);
    this.hideHint();
  }

  // ---------- launch overlay ----------
  private openLaunch(a: App): void {
    this.overlay = 'launch';
    qs('#launchMark').innerHTML = a.mark;
    qs('#launchTxt').textContent = `Opening ${a.name}`;
    const bar = qs<HTMLElement>('#launch .lbar i');
    bar.style.animation = 'none';
    void bar.offsetWidth;
    bar.style.animation = '';
    qs('#launch').classList.add('open');
    clearTimeout(this.launchTimer);
    this.launchTimer = window.setTimeout(() => this.closeLaunch(), this.reduceMotion ? 600 : 1600);

    // On the TV, actually open the app. In a browser the launch stays faked.
    if (native && a.pkg && !native.launch(a.pkg)) {
      qs('#launchTxt').textContent = `${a.name} isn't installed`;
    }
  }
  private closeLaunch(): void {
    qs('#launch').classList.remove('open');
    this.overlay = null;
  }

  // ---------- wallpaper ----------
  private paintInitial(): void {
    const css = `url("${wallpapers[this.wp].url}")`;
    qs('#photo').style.backgroundImage = css;
    this.setBarImages(css);
    // calm-tv.json "display": "glass": "tint" swaps the frosted bars for plain tinted glass.
    document.documentElement.classList.toggle('glass-tint', settings.config.display?.glass === 'tint');
    this.setBackground(this.persist.bg);
  }

  // ---------- video background ----------
  private videoUrl = '';
  private get vid(): number {
    const byName = videos.findIndex((v) => v.name === this.persist.vidName);
    if (byName >= 0) return byName;
    const n = this.persist.vid;
    return n >= 0 && n < videos.length ? n : 0;
  }
  /** Photo or video behind everything. The photo stays underneath, so it shows while a clip loads. */
  /** The background showing now (a saved video choice shows a photo while videos are turned off). */
  private bgMode: 'photo' | 'video' = 'photo';
  private setBackground(mode: 'photo' | 'video'): void {
    if (mode === 'video' && !videos.length) mode = 'photo';
    // Videos turned off in calm-tv.json: show a photo, but keep the saved choice for when they're back.
    if (mode === 'video' && !videosAllowed()) {
      mode = 'photo';
    } else {
      this.persist.bg = mode;
      save(this.persist);
    }
    this.bgMode = mode;
    document.documentElement.classList.toggle('bg-video', mode === 'video');
    const v = qs<HTMLVideoElement>('#video');
    if (mode === 'video') void this.playVideo(this.vid);
    else {
      v.pause();
      v.classList.remove('ready');
      v.removeAttribute('src');
      v.load();
      if (this.videoUrl) URL.revokeObjectURL(this.videoUrl);
      this.videoUrl = '';
    }
  }
  /**
   * Loads the whole clip into memory first, then loops it from there. Seeking and looping straight
   * from the app's built-in files is unreliable in the TV's web view; clips are small enough for this.
   */
  private async playVideo(i: number): Promise<void> {
    const clip = videos[i];
    const v = qs<HTMLVideoElement>('#video');
    if (!clip) return;
    try {
      // Clips on another server (Home Assistant's www folder) can't be read into memory (CORS),
      // so those play straight from their address.
      let src = clip.url;
      if (new URL(clip.url, location.href).origin === location.origin) {
        const blob = await (await fetch(clip.url)).blob();
        if (this.bgMode !== 'video' || this.vid !== i) return; // changed while loading
        src = URL.createObjectURL(blob);
      }
      if (this.videoUrl) URL.revokeObjectURL(this.videoUrl);
      this.videoUrl = src.startsWith('blob:') ? src : '';
      v.classList.remove('ready');
      v.src = src;
      v.addEventListener('playing', () => v.classList.add('ready'), { once: true });
      if (!document.hidden) await v.play();
    } catch (e) {
      console.warn('Video background failed', clip.name, e);
    }
  }
  /** Only play while Calm TV is on screen. */
  private pauseVideo(paused: boolean): void {
    const v = qs<HTMLVideoElement>('#video');
    if (this.bgMode !== 'video' || !v.src) return;
    if (paused) v.pause();
    else void v.play().catch(() => {});
  }
  private setBarImages(css: string): void {
    document.querySelectorAll<HTMLElement>('.gb-img').forEach((el) => (el.style.backgroundImage = css));
  }
  private get wp(): number {
    const n = this.persist.wp;
    return n >= 0 && n < wallpapers.length ? n : 0;
  }
  /** From the background picker: a clip or a photo. */
  private chooseBackground(c: BgChoice): void {
    if (c.kind === 'video') {
      const changed = this.bgMode !== 'video' || this.vid !== c.index;
      this.persist.vid = c.index;
      this.persist.vidName = videos[c.index]?.name ?? '';
      if (changed) this.setBackground('video');
    } else {
      if (c.index !== this.wp) this.showPhoto(c.index);
      if (this.bgMode !== 'photo') this.setBackground('photo');
    }
  }
  /** Cross-fades to the next wallpaper; returns its name. */
  private nextWallpaper(): string {
    return this.showPhoto((this.wp + 1) % wallpapers.length);
  }
  /** Cross-fades to photo n; returns its name. */
  private showPhoto(n: number): string {
    this.persist.wp = n;
    save(this.persist);
    const css = `url("${wallpapers[n].url}")`;
    const incoming = qs(this.frontA ? '#photo2' : '#photo');
    const outgoing = qs(this.frontA ? '#photo' : '#photo2');
    incoming.style.backgroundImage = css;
    incoming.style.opacity = '1';
    outgoing.style.opacity = '0';
    this.setBarImages(css);
    this.frontA = !this.frontA;
    return wallpapers[n].name;
  }

  // ---------- input ----------
  private wireInput(): void {
    document.addEventListener('keydown', (e) => {
      const k = e.key;
      if (this.doorbell.isOpen() && (k === 'Escape' || k === 'Backspace')) {
        e.preventDefault();
        this.doorbell.hide();
        return;
      }
      if (this.picker.isOpen()) { this.picker.handleKey(e); return; }
      if (this.settings.isOpen()) { this.settings.handleKey(e); return; }
      if (this.detail.isOpen()) { this.detail.handleKey(e); return; }
      if (this.overlay === 'launch') {
        if (k === 'Escape' || k === 'Backspace') {
          e.preventDefault();
          this.closeLaunch();
        } else if (k.startsWith('Arrow')) e.preventDefault();
        return;
      }
      switch (k) {
        case 'ArrowUp': e.preventDefault(); this.moveV(-1); break;
        case 'ArrowDown': e.preventDefault(); this.moveV(1); break;
        case 'ArrowLeft': e.preventDefault(); this.moveH(-1); break;
        case 'ArrowRight': e.preventDefault(); this.moveH(1); break;
        case 'Enter':
        case ' ': e.preventDefault(); this.activate(); break;
        case 'w':
        case 'W': this.nextWallpaper(); break;
        default: return;
      }
    });

    const sections = qs('#sections');
    sections.addEventListener('mouseover', (e) => {
      const el = (e.target as HTMLElement).closest('[data-item]') as HTMLElement | null;
      if (!el) return;
      const sec = Number(el.dataset.sec);
      const it = Number(el.dataset.item);
      if (sec !== this.secIndex) return;
      this.cols[sec] = it;
      this.sections[sec].focus(it);
    });
    sections.addEventListener('click', (e) => {
      const el = (e.target as HTMLElement).closest('[data-item]') as HTMLElement | null;
      if (!el) return;
      const sec = Number(el.dataset.sec);
      const it = Number(el.dataset.item);
      if (sec !== this.secIndex) return;
      this.cols[sec] = it;
      this.sections[sec].focus(it);
      this.activate();
    });

    qs('#launch').addEventListener('click', (e) => {
      if (e.target === e.currentTarget) this.closeLaunch();
    });

    // From the TV app: Home pressed (back to the app dock), and returning from another app.
    window.addEventListener('ct-home', () => this.goHome());
    // Dev only: try the doorbell window without anyone ringing.
    if (import.meta.env.DEV) {
      Object.assign(window, { ctRing: () => this.ring(), ctRingEnd: () => this.doorbell.hide() });
    }
    window.addEventListener('ct-resume', () => { this.closeLaunch(); this.pauseVideo(false); });
    window.addEventListener('ct-pause', () => this.pauseVideo(true));
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.closeLaunch();
      this.pauseVideo(document.hidden);
    });
  }

  /** Home button: close anything open and return to the app dock. */
  private goHome(): void {
    if (this.picker.isOpen()) this.picker.close();
    if (this.settings.isOpen()) this.settings.close();
    if (this.detail.isOpen()) this.detail.close();
    this.closeLaunch();
    if (this.secIndex !== 0) {
      this.secIndex = 0;
      this.render();
      this.sections[0].onEnter?.();
    }
  }

  // ---------- misc ----------
  private hideHint(): void {
    qs('#hint').classList.add('gone');
    clearTimeout(this.hintTimer);
  }
  private fit(): void {
    const s = Math.min(window.innerWidth / 1920, window.innerHeight / 1080);
    qs('#stage').style.transform = `translate(-50%, -50%) scale(${s})`;
  }
}
