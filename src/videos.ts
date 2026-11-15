// Auto-discover every looping clip dropped into src/videos/ (1080p mp4, no audio, ideally under ~20 MB:
// each clip is loaded whole into memory to loop smoothly). A .jpg with the same name is its thumbnail
// in the background picker. They ship inside the TV app like the photos; nothing is hosted anywhere.
const clips = import.meta.glob('./videos/*.{mp4,webm}', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;
const thumbs = import.meta.glob('./videos/*.jpg', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;

export interface Clip {
  name: string;
  url: string;
  /** Small still for the picker ('' if there isn't one). */
  thumb: string;
}

function prettyName(path: string): string {
  const file = path.split('/').pop() ?? path;
  const base = file.replace(/\.[^.]+$/, '').replace(/^\d+[-_\s]*/, '').replace(/[-_]+/g, ' ').trim();
  return base ? base.replace(/\b\w/g, (c) => c.toUpperCase()) : file;
}

/** Bundled clips, then any listed in calm-tv.json (added by main.ts). */
export const videos: Clip[] = Object.keys(clips)
  .sort()
  .map((path) => ({ name: prettyName(path), url: clips[path], thumb: thumbs[path.replace(/\.[^.]+$/, '.jpg')] ?? '' }));
