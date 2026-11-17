import * as v from 'valibot';
import type { MessageBase } from 'home-assistant-js-websocket';
import { ha } from '../ha';
import { haPath, settings } from '../config';
import { child } from '../dom';
import { FocusGroup } from '../focus';
import { attributes, BrowseNodeSchema, MediaPlayerAttributes, type BrowseChild, type BrowseNode } from '../ha-data';
import { hint } from '../hints';

// The Music panel: Music Assistant (or any media players) through Home Assistant. Opened from the
// dock's Music tile. Left: what the chosen speaker is playing, with its controls. Right: the
// speakers, and below them playlists (or other folders) from the player's media library, played on
// the chosen speaker. Everything goes through HA's media_player services and media browser, so
// the TV's own HA user is all it needs.

const wrap = (inner: string) =>
  `<svg viewBox="0 0 24 24" fill="currentColor" stroke="none">${inner}</svg>`;

const ICON = {
  prev: wrap('<path d="M6 5h2v14H6zM20 5.5v13a.5.5 0 0 1-.78.42L9.5 12.4a.5.5 0 0 1 0-.8l9.72-6.52a.5.5 0 0 1 .78.42z"/>'),
  next: wrap('<path d="M16 5h2v14h-2zM4 5.5v13a.5.5 0 0 0 .78.42l9.72-6.52a.5.5 0 0 0 0-.8L4.78 5.08A.5.5 0 0 0 4 5.5z"/>'),
  play: wrap('<path d="M7 4.6v14.8a.6.6 0 0 0 .92.5l11.2-7.4a.6.6 0 0 0 0-1L7.92 4.1A.6.6 0 0 0 7 4.6z"/>'),
  pause: wrap('<rect x="6" y="4.5" width="4" height="15" rx="1"/><rect x="14" y="4.5" width="4" height="15" rx="1"/>'),
  volDown: wrap('<path d="M4 9h3.5L12 5v14l-4.5-4H4zM15 11h6v2h-6z"/>'),
  volUp: wrap('<path d="M4 9h3.5L12 5v14l-4.5-4H4zM17 8h2v3h3v2h-3v3h-2v-3h-3v-2h3z"/>'),
  group: wrap('<path d="M3 8.5A2.5 2.5 0 0 1 5.5 6h4A2.5 2.5 0 0 1 12 8.5v9A2.5 2.5 0 0 1 9.5 20h-4A2.5 2.5 0 0 1 3 17.5zm4.5 1a1 1 0 1 0 0 2 1 1 0 0 0 0-2zm0 3.5a2.2 2.2 0 1 0 0 4.4 2.2 2.2 0 0 0 0-4.4zM14 4.5A2.5 2.5 0 0 1 16.5 2h2A2.5 2.5 0 0 1 21 4.5v11a2.5 2.5 0 0 1-2.5 2.5H14zm3.5 2a1 1 0 1 0 0 2 1 1 0 0 0 0-2zm0 4a2.2 2.2 0 1 0 0 4.4 2.2 2.2 0 0 0 0-4.4z"/>'),
  check: wrap('<path d="M9.5 16.2 5.3 12l-1.4 1.4 5.6 5.6L20.1 8.4 18.7 7z"/>'),
  playAll: wrap('<path d="M8 5.6v12.8a.6.6 0 0 0 .92.5l9.7-6.4a.6.6 0 0 0 0-1L8.92 5.1A.6.6 0 0 0 8 5.6z"/>'),
  note: wrap('<path d="M19 3.2v11.3a3.3 3.3 0 1 1-1.8-2.9V7.9L9.8 9.6v7.1a3.3 3.3 0 1 1-1.8-2.9V6.3a1 1 0 0 1 .78-.98l9-2.08A1 1 0 0 1 19 3.2z"/>'),
};

const lineIcon = (d: string) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;

/** Icons for the media browser's folders, matched by name (as Music Assistant's sidebar has them). */
const FOLDER_ICONS: [RegExp, string][] = [
  [/artist/i, lineIcon('<circle cx="10" cy="8" r="3.5"/><path d="M3.5 20a6.5 6.5 0 0 1 13 0"/><path d="M19 4v8.5a2 2 0 1 1-1.5-1.94"/>')],
  [/album/i, lineIcon('<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="2.5"/>')],
  [/track|song/i, lineIcon('<path d="M10 18V5l8-1.5"/><circle cx="7.5" cy="18" r="2.5"/>')],
  [/playlist/i, lineIcon('<path d="M4 6h11M4 11h11M4 16h6"/><path d="M18 9v8a2 2 0 1 1-1.5-1.94"/>')],
  [/audiobook|book/i, lineIcon('<path d="M5 4h10a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3z"/><path d="M5 17a3 3 0 0 1 3-3h10"/>')],
  [/podcast/i, lineIcon('<circle cx="12" cy="10" r="2.5"/><path d="M8 15a5.5 5.5 0 1 1 8 0M5.5 17.5a9 9 0 1 1 13 0"/><path d="M12 13v8"/>')],
  [/radio/i, lineIcon('<circle cx="12" cy="12" r="2"/><path d="M8.5 8.5a5 5 0 0 0 0 7M15.5 8.5a5 5 0 0 1 0 7M5.6 5.6a9 9 0 0 0 0 12.8M18.4 5.6a9 9 0 0 1 0 12.8"/>')],
  [/genre/i, lineIcon('<path d="M12 3l9 5-9 5-9-5z"/><path d="M3 12.5l9 5 9-5M3 16.5l9 5 9-5"/>')],
  [/favou?rite/i, lineIcon('<path d="M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0 1 12 7.4 4.3 4.3 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10z"/>')],
];

const folderIcon = (title: string) =>
  FOLDER_ICONS.find(([re]) => re.test(title))?.[1] ?? lineIcon('<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>');

interface Player {
  name: string;
  entity: string;
}

interface LibraryItem {
  title: string;
  id: string;
  type: string;
  thumb: string;
  canPlay: boolean;
  canExpand: boolean;
  /** The "Play all" card at the start of a folder that can be played as a whole. */
  playAll?: boolean;
}

/** One level of the library browser: a folder and where the remote is in it. */
interface Level {
  title: string;
  id: string;
  type: string;
  items: LibraryItem[] | null;
  msg: string;
  /** The item that opened this folder, to go back to it. */
  cameFrom: string | null;
}

const CONTROLS = ['prev', 'playpause', 'next', 'volDown', 'volUp', 'group'] as const;

/** A folder's items drawn at most (Music Assistant can list thousands of tracks). */
const MAX_ITEMS = 500;

/** The library buttons, in order, when calm-tv.json's "library" doesn't name its own: Music Assistant's folders. */
const DEFAULT_LIBRARY = ['Artists', 'Albums', 'Tracks', 'Playlists', 'Radio', 'Podcasts', 'Audiobooks'];
const VOLUME_STEP = 0.05;

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

/** The speakers from calm-tv.json's "music", or every media player that Music Assistant made. */
export function musicPlayers(): Player[] {
  const listed = settings.config.music?.players;

  if (listed?.length) return listed;

  return Object.values(ha.entities)
    .filter((e) => e.entity_id.startsWith('media_player.') && 'mass_player_type' in e.attributes)
    .map((e) => ({ name: attributes(e, MediaPlayerAttributes).friendly_name ?? e.entity_id, entity: e.entity_id }));
}

/** Nothing known about a speaker (it isn't in HA's states). */
const NO_ATTRIBUTES = v.parse(MediaPlayerAttributes, {});

/** A speaker's state and attributes, decoded; undefined when HA doesn't list it. */
function speaker(entity: string): { state: string; a: MediaPlayerAttributes } | undefined {
  const e = ha.entities[entity];

  return e ? { state: e.state, a: attributes(e, MediaPlayerAttributes) } : undefined;
}

export class MusicPanel {
  private el: HTMLElement;
  private open = false;
  /**
   * Remote, touch and mouse (see focus.ts). Ids: "control-play" etc., "speaker-2", "library-1",
   * "card-4" (in the open folder). OK and a tap both click the item; onClick says what that does.
   */
  private nav: FocusGroup;
  /** The browser's folders, outermost first; empty when the speakers and categories show. */
  private levels: Level[] = [];
  private active = 0;
  private players: Player[] = [];
  private cats: LibraryItem[] = [];
  private catsFor = '';
  private catsMsg = '';
  private tick = 0;
  /** Volume just set, shown until HA catches up. */
  private heldVolume: { entity: string; value: number; until: number } | null = null;
  /** The speakers' states as last drawn (see the constructor). */
  private lastSig = '';
  /** The album art now shown, so a redraw only swaps the picture when it really changes. */
  private artUrl: string | null = null;
  /** Choosing which speakers play along with the chosen one. */
  private grouping = false;
  /** Speakers just added (true) or taken out (false), shown until HA catches up. */
  private heldGroup = new Map<string, { joined: boolean; until: number }>();

  constructor(mount: HTMLElement) {
    this.el = document.createElement('div');
    this.el.className = 'music';
    this.el.innerHTML = `
      <div class="music-bg"></div>
      <div class="music-scrim"></div>
      <div class="music-body">
        <div class="music-now">
          <div class="music-art"></div>
          <div class="music-title"></div>
          <div class="music-artist"></div>
          <div class="music-group"></div>
          <div class="music-progress"><i></i></div>
          <div class="music-times"><span class="t-pos"></span><span class="t-dur"></span></div>
          <div class="music-controls">
            ${CONTROLS.map((c) => `<button class="mbtn" data-focus="control-${c}"></button>`).join('')}
            <span class="music-vol"></span>
          </div>
        </div>
        <div class="music-side">
          <div class="music-home">
            <div class="music-h music-spk-h">Speakers</div>
            <div class="music-speakers"></div>
            <div class="music-h music-lib-h">Library</div>
            <div class="music-cats"></div>
          </div>
          <div class="music-browse">
            <div class="music-crumbs"></div>
            <div class="music-grid"></div>
          </div>
        </div>
      </div>
      <button class="music-hint">${hint('musicClose')}</button>`;
    mount.appendChild(this.el);
    this.nav = new FocusGroup(this.el, { onBack: () => this.back() });
    this.el.addEventListener('click', (e) => this.onClick(e));
    // Every state change in the house arrives here; redraw only when one of the speakers changed.
    ha.onEntities(() => {
      if (!this.open) return;
      const sig = this.playersSignature();

      if (sig === this.lastSig) return;
      this.lastSig = sig;
      this.render();
    });
  }

  isOpen(): boolean {
    return this.open;
  }

  show(): void {
    this.players = musicPlayers();
    this.open = true;
    // Start on the speaker that's playing, if any.
    const playing = this.players.findIndex((p) => ha.entities[p.entity]?.state === 'playing');
    this.active = Math.max(0, playing);
    this.grouping = false;
    this.levels = [];
    this.lastSig = this.playersSignature();
    this.el.classList.add('open');
    this.render();
    this.nav.focus(`speaker-${this.active}`);
    void this.loadCats();
    this.tick = window.setInterval(() => this.renderProgress(), 1000);
  }

  close(): void {
    this.open = false;
    this.grouping = false;
    clearInterval(this.tick);
    this.el.classList.remove('open');
  }

  private playersSignature(): string {
    return JSON.stringify(this.players.map((p) => {
      const e = ha.entities[p.entity];

      return e ? [e.state, e.attributes] : null;
    }));
  }

  private get player(): Player | undefined {
    return this.players[this.active];
  }

  // ---------- Home Assistant ----------

  /** One folder of the speaker's media browser: the top level without `id`. */
  private async browse(entity: string, id?: string, type?: string): Promise<BrowseNode> {
    const conn = ha.connection;

    if (!conn) throw new Error('Not connected');
    const message: MessageBase = { type: 'media_player/browse_media', entity_id: entity };

    if (id) {
      message.media_content_id = id;
      message.media_content_type = type ?? '';
    }

    return v.parse(BrowseNodeSchema, await conn.sendMessagePromise<unknown>(message));
  }

  /** The library's categories (Artists, Albums, Playlists…): the folders at the top of the chosen speaker's media browser. */
  private async loadCats(): Promise<void> {
    const p = this.player;

    if (!p || !ha.connection || this.catsFor === p.entity) return;
    this.catsFor = p.entity;
    this.catsMsg = 'Loading…';
    this.renderCats();
    // Matched by exact name, so other media sources (Radio Browser, Camera, Text-to-speech…) stay out.
    const wanted = (settings.config.music?.library?.length ? settings.config.music.library : DEFAULT_LIBRARY).map(norm);

    try {
      const root = await this.browse(p.entity);
      const folders = (root.children ?? []).filter((c) => c.can_expand && c.media_content_id);
      this.cats = wanted.flatMap((w) => {
        const f = folders.find((c) => norm(c.title ?? '') === w);

        return f ? [toItem(f)] : [];
      });
      this.catsMsg = this.cats.length ? '' : 'Nothing in the library';
    } catch (e) {
      console.warn('Music library', e);
      this.cats = [];
      this.catsMsg = 'Couldn’t load the library';
    }

    this.renderCats();
    this.nav.paint();
  }

  /** Opens a folder in the browser (a category, an artist, an album…). */
  private async openFolder(item: LibraryItem): Promise<void> {
    const p = this.player;

    if (!p) return;
    const level: Level = { title: item.title, id: item.id, type: item.type, items: null, msg: 'Loading…', cameFrom: this.nav.id };
    this.levels.push(level);
    this.renderBrowse();

    try {
      const node = await this.browse(p.entity, item.id, item.type);
      const children = (node.children ?? []).filter((c) => c.media_content_id && (c.can_play || c.can_expand));
      const items = children.slice(0, MAX_ITEMS).map(toItem);

      if (node.can_play && items.length) items.unshift({ title: 'Play all', id: item.id, type: item.type, thumb: '', canPlay: true, canExpand: false, playAll: true });
      level.items = items;
      level.msg = !items.length ? 'Nothing here' : children.length > MAX_ITEMS ? `Showing the first ${MAX_ITEMS} of ${children.length}` : '';
    } catch (e) {
      console.warn('Music browse', e);
      level.items = [];
      level.msg = 'Couldn’t load this';
    }

    if (this.levels.at(-1) !== level) return;
    this.renderBrowse();
    this.nav.focus('card-0');
  }

  /** Up a folder, back to what opened it. */
  private closeFolder(): void {
    const level = this.levels.pop();
    this.render();
    this.nav.focus(level?.cameFrom ?? null);
  }

  private act(service: string, data: Record<string, string | number> = {}): void {
    const p = this.player;

    if (p) void ha.call('media_player', service, { entity_id: p.entity, ...data });
  }

  private volume(): number | undefined {
    const p = this.player;

    if (!p) return undefined;

    if (this.heldVolume && this.heldVolume.entity === p.entity && this.heldVolume.until > Date.now()) return this.heldVolume.value;

    return speaker(p.entity)?.a.volume_level;
  }

  /** The speakers playing together with the chosen one (the chosen one included). */
  private group(): Set<string> {
    const p = this.player;

    if (!p) return new Set();
    const set = new Set<string>([p.entity, ...(speaker(p.entity)?.a.group_members ?? [])]);

    for (const [entity, held] of this.heldGroup) {
      if (held.until < Date.now()) this.heldGroup.delete(entity);
      else if (held.joined) set.add(entity);
      else set.delete(entity);
    }

    set.add(p.entity);

    return set;
  }

  /** Adds a speaker to the chosen one's group, or takes it out. */
  private toggleGroup(entity: string): void {
    const p = this.player;

    if (!p || entity === p.entity) return;
    const joined = !this.group().has(entity);
    this.heldGroup.set(entity, { joined, until: Date.now() + 5000 });

    if (joined) void ha.call('media_player', 'join', { entity_id: p.entity, group_members: [entity] });
    else void ha.call('media_player', 'unjoin', { entity_id: entity });
  }

  private startGrouping(): void {
    if (this.players.length < 2) return;
    this.grouping = true;
    this.render();
    this.nav.focus(`speaker-${this.active === 0 ? 1 : 0}`);
  }

  private stopGrouping(): void {
    this.grouping = false;
    this.render();
    this.nav.focus(`speaker-${this.active}`);
  }

  private press(c: (typeof CONTROLS)[number]): void {
    const state = this.player ? ha.entities[this.player.entity]?.state : undefined;

    switch (c) {
      case 'prev': this.act('media_previous_track'); break;
      case 'next': this.act('media_next_track'); break;
      case 'playpause': this.act(state === 'playing' ? 'media_pause' : 'media_play'); break;
      case 'volDown':
      case 'volUp': {
        const now = this.volume();

        if (now === undefined || !this.player) break;
        const value = Math.round(Math.min(1, Math.max(0, now + (c === 'volUp' ? VOLUME_STEP : -VOLUME_STEP))) * 100) / 100;
        this.heldVolume = { entity: this.player.entity, value, until: Date.now() + 4000 };
        this.act('volume_set', { volume_level: value });
        break;
      }

      case 'group': this.startGrouping(); break;
    }

    this.render();
  }

  private playItem(item: LibraryItem): void {
    this.act('play_media', { media_content_id: item.id, media_content_type: item.type });
    const grid = child(this.el, '.music-grid');
    grid.querySelector('.mcard.started')?.classList.remove('started');
    grid.querySelector('.mcard.focus')?.classList.add('started');
  }

  // ---------- drawing ----------

  private render(): void {
    if (!this.open) return;
    const p = this.player;
    const s = p ? speaker(p.entity) : undefined;
    const a = s?.a ?? NO_ATTRIBUTES;
    const pic = a.entity_picture ? haPath(a.entity_picture) : '';

    if (pic !== this.artUrl) {
      this.artUrl = pic;
      child(this.el, '.music-art').innerHTML = pic ? `<img src="${esc(pic)}" alt="">` : `<div class="music-art-empty">${ICON.note}</div>`;
      child(this.el, '.music-bg').style.backgroundImage = pic ? `url("${pic.replace(/"/g, '%22')}")` : 'none';
    }

    child(this.el, '.music-title').textContent = a.media_title || (s ? (s.state === 'unavailable' ? 'Unavailable' : 'Nothing playing') : 'No speakers');
    child(this.el, '.music-artist').textContent = [a.media_artist, a.media_album_name].filter(Boolean).join(' · ') || (p?.name ?? '');

    const group = this.group();
    const others = this.players.filter((pl) => pl.entity !== p?.entity && group.has(pl.entity)).map((pl) => pl.name);
    child(this.el, '.music-group').innerHTML = others.length ? `${ICON.group}<span>Also on ${esc(others.join(', '))}</span>` : '';
    const how = hint('groupSpeakers');
    child(this.el, '.music-spk-h').textContent = this.grouping ? `Play on ${p?.name ?? ''} and… · ${how}` : 'Speakers';
    this.el.classList.toggle('grouping', this.grouping);

    this.el.querySelectorAll<HTMLElement>('.mbtn').forEach((b, i) => {
      const c = CONTROLS[i];
      b.innerHTML = c === 'playpause' ? (s?.state === 'playing' ? ICON.pause : ICON.play) : ICON[c];
      b.classList.toggle('big', c === 'playpause');
      // While grouping, only the speakers can be chosen.
      b.setAttribute('aria-disabled', String(this.grouping));
    });
    const vol = this.volume();
    child(this.el, '.music-vol').textContent = vol === undefined ? '' : `${Math.round(vol * 100)}%`;

    child(this.el, '.music-speakers').innerHTML = this.players
      .map((pl, i) => {
        const e = speaker(pl.entity);
        const inGroup = i !== this.active && group.has(pl.entity);

        const status = !e || e.state === 'unavailable' ? 'Unavailable'
          : inGroup ? `With ${p?.name ?? ''}`
          : this.grouping && i === this.active ? 'Chosen speaker · OK when done'
          : e.state === 'playing' ? `Playing · ${e.a.media_title ?? ''}` : e.state === 'paused' ? 'Paused' : 'Idle';

        const cls = ['mspk', i === this.active ? 'active' : '', inGroup ? 'grouped' : '', e?.state === 'playing' ? 'playing' : ''].join(' ');
        const mark = this.grouping ? `<span class="mspk-check${i === this.active || inGroup ? ' on' : ''}">${i === this.active || inGroup ? ICON.check : ''}</span>` : '<span class="mspk-dot"></span>';

        return `<div class="${cls}" data-focus="speaker-${i}">${mark}<div class="mspk-text"><div class="mspk-name">${esc(pl.name)}</div><div class="mspk-status">${esc(status)}</div></div></div>`;
      })
      .join('');

    this.renderProgress();
    this.renderCats();
    this.renderBrowse();
    // The speakers and buttons were drawn again: put the focus back on them.
    this.nav.paint();
  }

  private renderCats(): void {
    const box = child(this.el, '.music-cats');

    if (!this.cats.length) {
      box.innerHTML = `<div class="music-lib-msg">${esc(this.catsMsg)}</div>`;

      return;
    }

    box.innerHTML = this.cats
      .map((c, i) => `<div class="mcat" data-focus="library-${i}" aria-disabled="${this.grouping}">${folderIcon(c.title)}<span>${esc(norm(c.title) === 'radio' ? 'Radio' : c.title)}</span></div>`)
      .join('');
  }

  /** The browser's grid is drawn once per folder; moving the remote only moves the focus. */
  private drawnLevel: Level | null = null;

  private renderBrowse(): void {
    const level = this.levels.at(-1);
    this.el.classList.toggle('browsing', !!level);
    child(this.el, '.music-hint').textContent = hint(level ? 'musicUp' : this.grouping ? 'musicDone' : 'musicClose');

    if (!level) {
      this.drawnLevel = null;

      return;
    }

    const grid = child(this.el, '.music-grid');
    child(this.el, '.music-crumbs').innerHTML = this.levels.map((l) => `<span>${esc(l.title)}</span>`).join('<i>›</i>')
      + (level.msg && level.items?.length ? `<em>${esc(level.msg)}</em>` : '');

    if (this.drawnLevel !== level || grid.dataset.ready !== String(!!level.items)) {
      this.drawnLevel = level;
      grid.dataset.ready = String(!!level.items);
      grid.scrollTop = 0;
      grid.innerHTML = !level.items?.length
        ? `<div class="music-lib-msg">${esc(level.msg)}</div>`
        : level.items
          .map((it, i) => `<div class="mcard${it.playAll ? ' playall' : ''}" data-focus="card-${i}">
              <div class="mcard-art">${it.playAll ? ICON.playAll : it.thumb ? `<img loading="lazy" src="${esc(it.thumb)}" alt="">` : it.canExpand ? folderIcon(this.levels[0]?.title ?? '') : ICON.note}</div>
              <div class="mcard-name">${esc(it.title)}</div></div>`)
          .join('');
    }
  }

  /** The progress bar moves on its own between HA updates while playing. */
  private renderProgress(): void {
    const s = this.player ? speaker(this.player.entity) : undefined;
    const a = s?.a ?? NO_ATTRIBUTES;
    const dur = a.media_duration ?? 0;
    let pos = a.media_position ?? 0;

    if (s?.state === 'playing' && a.media_position_updated_at) {
      pos += (Date.now() - Date.parse(a.media_position_updated_at)) / 1000;
    }

    pos = Math.min(Math.max(0, pos), dur || pos);
    child(this.el, '.music-progress i').style.width = dur ? `${(pos / dur) * 100}%` : '0';
    child(this.el, '.t-pos').textContent = dur ? mmss(pos) : '';
    child(this.el, '.t-dur').textContent = dur ? mmss(dur) : '';
  }

  // ---------- remote, touch and mouse (see focus.ts) ----------

  /** Back: up a folder, out of grouping, or closed. */
  private back(): void {
    if (this.levels.length) this.closeFolder();
    else if (this.grouping) this.stopGrouping();
    else this.close();
  }

  /**
   * What choosing an item does, whether by OK on the remote (which clicks the focused item), a tap
   * or a mouse click. The bottom hint is the Back button for touch and mouse.
   */
  private onClick(e: MouseEvent): void {
    const target = e.target instanceof Element ? e.target : null;

    if (target?.closest('.music-hint')) {
      this.back();

      return;
    }

    const id = target?.closest<HTMLElement>('[data-focus]')?.dataset.focus ?? '';
    const [kind, which = ''] = id.split('-');
    const i = Number(which);

    if (kind === 'control') {
      const c = CONTROLS.find((x) => x === which);

      if (c && !this.grouping) this.press(c);
    } else if (kind === 'speaker') {
      const pl = this.players[i];

      if (!pl) return;

      if (this.grouping) {
        if (i === this.active) this.stopGrouping();
        else {
          this.toggleGroup(pl.entity);
          this.render();
        }
      } else {
        this.active = i;
        void this.loadCats();
        this.render();
      }
    } else if (kind === 'library') {
      const c = this.cats[i];

      if (c && !this.grouping) void this.openFolder(c);
    } else if (kind === 'card') {
      const it = this.levels.at(-1)?.items?.[i];

      if (it?.canExpand && !it.playAll) void this.openFolder(it);
      else if (it?.canPlay) this.playItem(it);
    }
  }

  handleKey(e: KeyboardEvent): void {
    this.nav.handleKey(e);
  }
}

const toItem = (c: BrowseChild): LibraryItem => ({
  title: c.title ?? '',
  id: c.media_content_id ?? '',
  type: c.media_content_type ?? 'music',
  thumb: c.thumbnail ? haPath(c.thumbnail) : '',
  canPlay: !!c.can_play,
  canExpand: !!c.can_expand,
});

/** Folder names compared without case, and "Radio stations" as "Radio". */
const norm = (t: string) => t.trim().toLowerCase().replace(/^radio stations?$/, 'radio');
