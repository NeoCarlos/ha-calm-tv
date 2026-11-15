// Real brand icons as raw SVG strings. Files live in src/icons/*.svg.
// CleanFrame's set (from the CC0 Simple Icons collection); Plex pulled from Simple Icons directly.
const raw = import.meta.glob('./icons/*.svg', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

export function icon(file: string): string {
  return raw[`./icons/${file}.svg`] ?? '';
}
