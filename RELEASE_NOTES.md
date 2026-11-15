# Release notes

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
