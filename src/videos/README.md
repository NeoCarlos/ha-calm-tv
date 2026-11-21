# Video backgrounds

Looping clips dropped here are built into the app and appear under **Videos** in
Settings → Background. They're found automatically, like the photos in `../wallpapers/`.

- **Name:** `NN-some-name.mp4` → shown as "Some Name", ordered by the number.
- **Times of day:** `NN-name.dawn.mp4`, `.day.mp4`, `.dusk.mp4`, `.night.mp4` are one background whose
  version follows the sun once it's chosen (see `sky` in docs/configuration.md).
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

## Making a clip loop seamlessly

Most clips don't end where they start, so they jump once per loop. Crossfading the clip with itself
fixes that: start the loop 1.5 s in, and blend its last 1.5 s into its own first 1.5 s. The result is
1.5 s shorter and ends on exactly the frame it starts with. For a 10 s clip (`offset` = length − 2 × 1.5):

```bash
ffmpeg -i input.mp4 -an -filter_complex "[0:v]fps=24,format=yuv420p,split[a][b];\
[a]trim=start=1.5,setpts=PTS-STARTPTS,settb=AVTB[main];\
[b]trim=end=1.5,setpts=PTS-STARTPTS,settb=AVTB[head];\
[main][head]xfade=transition=fade:duration=1.5:offset=7[x];\
[x]scale='min(1920,iw)':-2:flags=lanczos[out]" -map "[out]" -map_metadata -1 \
  -c:v libx264 -preset slow -crf 22 -maxrate 8M -bufsize 16M -pix_fmt yuv420p \
  -profile:v high -movflags +faststart 01-my-clip.mp4
```

It works best when the camera holds still and only things like water, mist or clouds move; a moving
camera can show double edges during the blend. Both included clips were made this way.

**Without rebuilding:** put clips in Home Assistant's `www` folder and list them under
`backgrounds.videos` in `calm-tv.json` (docs/configuration.md).

Three backgrounds are included: `00-mountain-lake-sunset.mp4`, `01-stylized-forest-brook.mp4` and
`02-alpine-lake-time-of-day` (four clips, `.dawn`, `.day`, `.dusk` and `.night.mp4`, which the living
sky switches between by the sun; dawn and dusk share one sunrise clip), made for this project and covered by its MIT licence. Any other clip in this folder is ignored by git unless you whitelist it by name in
`.gitignore`. Free stock-video sites generally allow personal use but not republishing the files, so
only commit a clip you made or clearly have the rights to share.
