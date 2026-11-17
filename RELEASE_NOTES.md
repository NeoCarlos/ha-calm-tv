# Release notes

## Unreleased

- **Dashboard mode** (`?dash`): the app for a touch screen, as a Home Assistant dashboard. A tab bar
  (time, screens, now playing, Music, Settings) replaces the Apps screen; everything can be tapped,
  dimmers are dragged, the thermostat has − and +, and swiping changes screens. Inside a dashboard
  it uses Home Assistant's own sign-in. `npm run publish:ha` puts it in Home Assistant's www folder
  and updates the dashboard's address. See docs/dashboard.md.
- **One input layer for every panel** (`src/focus.ts`): rooms, Settings, Music and the background
  picker now share how the remote, touch and a mouse work, so OK and a tap always do the same thing.
  On the TV, the arrows move to the nearest item by position, and going back the way you came
  returns to where you were.
- **`npm test`:** type-checks and drives the demo with the remote and with taps; it runs on every
  pull request. A pull request template lists what to check.
- After signing in with Home Assistant's login page, the address keeps its other settings (it used
  to drop all of them).
- Settings: the round button in a sub-menu now goes back a level when clicked, as Back does.
- **Faster Settings:** moving up and down the Settings menu (and room panels) no longer repaints
  the frosted panel: the highlight is its own layer that only fades, like the dock's.
- **Music Assistant in Settings:** Settings → Home Assistant → Music Assistant (or the gear in the
  Music panel) connects the TV to Music Assistant with its address and a token, kept on the TV only.
  Optional: it adds the whole queue (Home Assistant only passes what's playing and what's next),
  where OK jumps to a song. A token can also be given with `adb … --es maToken <token>`.
- **Music panel:** shuffle and queue buttons; a Group speakers button above the speakers, with
  Play everywhere; OK on the chosen speaker opens its own volume slider; the volume buttons turn
  every grouped speaker; speakers and library on frosted sheets like the dock, fixed-size speaker
  cards with scrolling names, bigger library buttons (3 across) and podcast icon; everything else
  fades back while grouping; Up from the controls reaches the library.
- **Music screen** (with `"music"` in calm-tv.json, after Smart Home): the album art with the song,
  artist and time beneath it, and the main controls on a frosted bar. After a few seconds without a
  key press the bar fades and the art settles to the middle (the first OK, ← or → only wakes it).
  Nothing playing, nothing shown. The album's colour can show behind it: `"background"` under
  `music` (or **Settings → Appearance → Music background**) picks none (the default), glow, wash or
  solid. A thin wave under the time lights up as the song plays and drifts while it does (**Music
  wave**, on by default). On the dashboard,
  Music is a tab.
- **Settings → Appearance** gathers everything about how Calm TV looks: Background, Music
  background, video backgrounds, frosted glass, screen transitions and the frame-rate counter (it
  replaces Performance, and Background moves into it).
- **Music panel**, under More on the Music screen: now playing,
  controls, speakers and library buttons (Artists, Albums, Playlists, Radio…) that open a browsable grid, through Home Assistant (made for Music Assistant). In demo mode too.
  The group button picks speakers to play along with the chosen one (media_player.join / unjoin).
- **Arrange dock:** Settings → Arrange dock moves tiles with the remote (OK picks up, ←/→ moves, OK puts down). The order is kept on the TV; "Back to the original order" resets it.
- **Bigger doorbell window, and pause:** `"size"` (width in % of the screen), `"position": "center"`
  `"pause": true` and `"sound": true` under `doorbell` in calm-tv.json, and a picture within a second from HA's camera proxy before live video connects. Over another app, Back now closes the
  doorbell window. Reolink doorbell example in docs/home-assistant.md.
- **Live demo:** [neocarlos.github.io/ha-calm-tv](https://neocarlos.github.io/ha-calm-tv/), built from
  the repo by a GitHub Pages workflow (`npm run build:site`): always in demo mode, with the background
  videos re-encoded about 60% smaller for the web.
- **On-screen remote** in demo mode on touch screens: arrows, OK and Back, under the picture in
  portrait and beside it in landscape.
- Demo mode never opens a Home Assistant sign-in page.
- **More app icons:** Jellyfin, Emby, Kodi, Spotify, YouTube Music, Apple Music, TIDAL, Home Assistant,
  Twitch, Steam, NVIDIA (GeForce NOW), PlayStation, Crunchyroll, Paramount+, Tubi and YouTube Kids
  (from Simple Icons). And `icon` in calm-tv.json can now be your own SVG or PNG in Home
  Assistant's `www` folder, with no rebuild.
- **Peacock icon:** the current P-and-dots mark.
- **Choose your screens:** `"screens": ["apps", "smarthome", "weather"]` in calm-tv.json shows
  only those, in that order (Apps always first). Leave it out for all four.
- **Demo mode on a TV:** `adb shell am start -n io.github.neocarlos.hacalmtv/.MainActivity --es demo ""`
  opens it (`--es demo off` goes back). Demo mode now keeps its own saved choices, so trying it never
  changes the TV's real background or settings.
- **Tour video:** demo mode can show captions (`ctDemo.caption`), and `scripts/record-tour.mjs`
  records a captioned tour as an MP4, optionally with music.

## 0.2.0

- **Demo mode:** open the app with `?demo` to try every screen against a made-up home (the example
  config), with sample calendar events, a week of weather and a placeholder doorbell camera. No Home
  Assistant needed. `?demo&at=2026-11-14T18:30` sets the clock, for repeatable recordings.
- **Backgrounds:** the repo now ships two backgrounds made for the project, "Mountain Lake Sunset"
  and "Stylized Forest Brook", each as a photo and a seamlessly looping video (crossfaded with
  itself), in place of the eight Unsplash photos. Other photos and clips you add stay in your own
  builds but out of git. The chosen photo is remembered by name, so adding or removing photos
  doesn't change it.
- **Settings → Performance:** switches for video backgrounds, frosted glass and screen transitions
  (new: Instant), and a frame-rate counter for comparing on the TV. Each TV keeps its own choices;
  `display` in calm-tv.json sets the default (now including `transitions`).
- **Settings, reorganized:** Background, Performance, Home Assistant (connection, address, home
  setup), Google TV home and TV settings. Sub-menus open in place; Back returns.
- **The background picker follows the video setting:** videos while they're on, photos while they're off.
- **Light control:** pressing ◀ right after switching a light on now dims it, instead of turning it
  back off.
- **README:** opens with the video background, then a section per feature, each with an animation
  recorded from demo mode. `npm run record:demo` re-records them (needs Chrome, ffmpeg and img2webp).

The APK on the release page is a debug build with the two project backgrounds. Build your own from
source for anything long-term (see `docs/tv-setup.md`).

## 0.1.0

The first shared version: a calm Google TV home screen driven by Home Assistant.

- **Four screens:** Apps (clock and a dock of your streaming apps), Smart Home (rooms with lights,
  plugs, curtains, scenes, thermostat, live cameras, and status-only locks, sensors and vacuums),
  Calendar (month grid, tonight's dinner, the next 14 days by day) and Weather (7 days, hour by hour).
- **One app, any home.** Rooms, apps, calendars, weather and the doorbell come from `calm-tv.json`,
  read from Home Assistant's `www` folder or a file pushed to the TV. Setup asks for Home Assistant's
  address once and goes straight to its sign-in.
- **Backgrounds:** eight photos, plus your own looping video clips (none included) with a thumbnail
  picker. Frosted or tinted glass, chosen in the config.
- **Remote-first:** the Home button returns to Calm TV; Settings can switch back to Google's home.
- **Outside data is decoded where it enters**, so an unexpected attribute or a typo in the config
  shows a clear message instead of breaking a screen.

The APK on the release page is a debug build with no video clips. Build your own from source for
anything long-term (see `docs/tv-setup.md`).
