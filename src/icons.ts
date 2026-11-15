// Brand icons as raw SVG strings, from src/icons/*.svg. Sources and licences for each are in
// THIRD_PARTY_NOTICES.md (Simple Icons, Custom Brand Icons, Material Icons, CleanFrame's set).
const raw = import.meta.glob<string>('./icons/*.svg', {
  query: '?raw',
  import: 'default',
  eager: true,
});

export function icon(file: string): string {
  return raw[`./icons/${file}.svg`] ?? '';
}
