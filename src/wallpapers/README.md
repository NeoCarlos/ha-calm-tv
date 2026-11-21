# Wallpapers

Drop your real photos in this folder and they appear automatically — no code changes.

- **Formats:** `.jpg`, `.jpeg`, `.png`, `.webp`, `.avif`, `.svg`
- **Recommended size:** ~2560px wide, 16:9. Larger is fine; the app covers the screen.
- **Display name:** taken from the filename. A leading number orders the list and is stripped
  from the name, and dashes/underscores become spaces. Examples:
  - `01-big-sur.jpg` → shown as **Big Sur**, sorted near the top
  - `tahoe_morning.png` → shown as **Tahoe Morning**

## Included photos

`00-mountain-lake-sunset.jpg` ("Mountain Lake Sunset") and `01-stylized-forest-brook.jpg`
("Stylized Forest Brook"), made for this project (with Google Flow) and covered by its MIT licence.
Each is also a video background (`../videos/`).
`02-alpine-lake-time-of-day.{dawn,day,dusk,night}.jpg` ("Alpine Lake Time of Day") are the first frames
of that video background's four clips, so it still follows the time of day with video backgrounds off.

Other photos you put here still build into your own app, but git ignores them, so they're never
published by accident. To share one you have the rights to, whitelist it by name in `.gitignore`
(`!src/wallpapers/NN-name.jpg`) and credit it in `THIRD_PARTY_NOTICES.md`.
