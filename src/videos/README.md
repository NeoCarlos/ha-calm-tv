# Video backgrounds

Looping clips dropped here are built into the app and appear under **Videos** in
Settings → Background. They're found automatically, like the photos in `../wallpapers/`.

- **Name:** `NN-some-name.mp4` → shown as "Some Name", ordered by the number.
- **Thumbnail:** a `.jpg` with the same name, 480×270 (made by the commands below).
- **Size:** 1080p, H.264, **no audio**, ideally **under 20 MB** each. Each clip is loaded into
  memory to loop smoothly, and the app grows by the size of every clip you add.
- **What works best:** slow, gentle motion (water, mist, rain, fire), a seamless loop of 10–30 s,
  and calmer, darker areas near the top and bottom, where text and bars sit.

## Shrinking a clip and making its thumbnail

```bash
ffmpeg -i input.mp4 -an -vf "scale='min(1920,iw)':-2:flags=lanczos,fps=30" \
  -c:v libx264 -preset slow -crf 22 -maxrate 8M -bufsize 16M -pix_fmt yuv420p \
  -profile:v high -movflags +faststart 01-my-clip.mp4
ffmpeg -ss 1.5 -i 01-my-clip.mp4 -frames:v 1 -vf scale=480:270 -q:v 4 01-my-clip.jpg
```

Drop `fps=30` to keep the original frame rate if it's 30 or lower. Rebuild the app afterwards
(`npm run tv:install`).

**Without rebuilding:** put clips in Home Assistant's `www` folder and list them under
`backgrounds.videos` in `calm-tv.json` (docs/configuration.md).

No clips are included in this repository: clips in this folder are ignored by git unless you
whitelist one by name in `.gitignore`. Free stock-video sites generally allow personal use but not
republishing the files, so only commit a clip you made or clearly have the rights to share.
