# HA Calm TV

A calm **Google TV home screen** driven by **Home Assistant**. It shows a full-bleed photo or a
slow looping video, a quiet clock, and frosted-glass bars you drive with the TV remote.

Four screens, stacked vertically. **↑ ↓** cross-fades between them, **← →** moves within one,
**OK/Enter** selects, and **Back/Esc** closes things.

| Screen | What it shows |
| --- | --- |
| **Apps** | Clock and date, plus a dock of your streaming apps. On the TV, apps that aren't installed are hidden. |
| **Smart Home** | The thermostat, plus a bar of rooms. Open a room to control lights, plugs, curtains, scenes and the thermostat, watch cameras live, and see locks, sensors and robot vacuums. Locks and doors are status only. |
| **Calendar** | Date, tonight's dinner, a month grid, and the next 14 days grouped by day. |
| **Weather** | Today and the next 6 days, with an hour-by-hour chart. |

**Settings** is the gear at the end of the dock. It has these options:
- **Home Assistant:** sign in or out.
- **Home Assistant address**
- **Home setup:** which `calm-tv.json` is loaded; reload it.
- **Google TV home:** switch to Google's launcher.
- **TV settings:** open the TV's own settings.
- **Background:** a thumbnail picker of photos and videos.

## One app, any home

Nothing about a particular home is built into the app. Each TV gets two things:

1. **Home Assistant's address.** Typed once on the TV's first-run screen, or sent over adb.
2. **`calm-tv.json`**, describing the home: rooms and devices, apps, calendars, weather and
   the doorbell. The TV reads it from Home Assistant's `www` folder, or from a file pushed onto the TV.
   See [`docs/configuration.md`](docs/configuration.md) and
   [`config/calm-tv.example.json`](config/calm-tv.example.json).

So the same APK works for anyone. Rebuild only to change the app itself.

## Commands

```bash
npm install                 # once
npm run dev                 # browser preview at http://localhost:5173
CT_DEV_TOKEN=1 npm run dev  # …connected to HA with a dev token (docs/tv-setup.md)
npm run typecheck
npm run tv:apk              # build the APK (needs JAVA_HOME and the Android SDK)
npm run tv:install          # build and install on the TV over adb
```

For the browser preview, put `VITE_HA_URL=http://<your-ha>:8123` in `.env.local`, and your
`calm-tv.json` in this folder.

## Docs

| Doc | For |
| --- | --- |
| [`AGENTS.md`](AGENTS.md) | AI coding agents: start here |
| [`docs/getting-started.md`](docs/getting-started.md) | From zero to Calm TV on your TV, in order |
| [`docs/configuration.md`](docs/configuration.md) | Every option in `calm-tv.json` |
| [`docs/home-assistant.md`](docs/home-assistant.md) | What Home Assistant needs |
| [`docs/tv-setup.md`](docs/tv-setup.md) | Building, installing, making it the home screen, debugging |
| [`docs/architecture.md`](docs/architecture.md) | How the code fits together |
| [`docs/lessons-learned.md`](docs/lessons-learned.md) | Pitfalls already hit and solved |

## Project layout

| Path | What it is |
| --- | --- |
| `index.html` | The stage: background layers, section track, overlays |
| `src/main.ts` | Start-up: loads the config, then builds the screens |
| `src/config.ts` | `calm-tv.json`: its format, loading, the HA address |
| `src/app.ts` | The orchestrator: sections, remote input, backgrounds, HA wiring |
| `src/ha.ts` | Home Assistant connection: OAuth sign-in, live states, service calls |
| `src/home-data.ts` | Rooms built from the config, and how HA states become status lines |
| `src/apps.ts` | The app dock (config `apps`, or a built-in default lineup) |
| `src/sections/` | One file per screen, plus room detail, settings, background picker |
| `src/setup.ts` | The first-run "Connect to Home Assistant" screen |
| `src/camera-stream.ts` | Live camera video over WebRTC through HA |
| `src/doorbell.ts` | Optional doorbell video window |
| `src/wallpapers/`, `src/videos/` | Built-in backgrounds, discovered automatically |
| `src/style.css` | All styling, in 1920×1080 stage coordinates |
| `android/` | The Android TV app: WebView, Home-button service, JS bridge, config loader |
