import type { App } from './types';
import { icon } from './icons';
import { installedPackages } from './native';
import { settings } from './config';

// The built-in dock lineup, used when calm-tv.json has no "apps", in order. Each `mark` is a brand SVG from src/icons/,
// recolored to white in CSS. `pkg` is the Android TV package the tile opens.
// Reorder or edit freely.
const lineup: App[] = [
  { name: 'YouTube', mark: icon('youtube'), pkg: 'com.google.android.youtube.tv' },
  { name: 'Netflix', mark: icon('netflix'), pkg: 'com.netflix.ninja' },
  { name: 'Prime Video', mark: icon('primevideo'), pkg: 'com.amazon.amazonvideo.livingroom' },
  { name: 'Disney+', mark: icon('disneyplus'), pkg: 'com.disney.disneyplus' },
  { name: 'Hulu', mark: icon('hulu'), pkg: 'com.hulu.livingroomplus' },
  { name: 'Apple TV+', mark: icon('appletv'), pkg: 'com.apple.atve.androidtv.appletv' },
  { name: 'Peacock', mark: icon('peacock'), pkg: 'com.peacocktv.peacockandroid' },
  { name: 'Google TV', mark: icon('googletv'), pkg: 'com.google.android.videos' },
  { name: 'HBO Max', mark: icon('hbomax'), pkg: 'com.wbd.stream' },
];

// Calm TV's own Settings, always last: off-screen until you scroll the dock to the end.
const settingsTile: App = { name: 'Settings', mark: icon('settings'), kind: 'settings' };

/** The dock: calm-tv.json's "apps" if it lists any, otherwise the lineup above. */
export let apps: App[] = [];

/** Call after loadConfig(). On the TV, apps that aren't installed are hidden; in a browser, all show. */
export function loadApps(): void {
  const fromConfig = settings.config.apps?.map((a) => ({ name: a.name, pkg: a.package, mark: (a.icon && icon(a.icon)) || textMark(a.name) }));
  const list = fromConfig?.length ? fromConfig : lineup;
  const installed = installedPackages();
  apps = [...(installed ? list.filter((a) => !a.pkg || installed.has(a.pkg)) : list), settingsTile];
}

/** An app without an icon file shows its name instead. */
function textMark(name: string): string {
  return `<span class="mark-text">${name.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)}</span>`;
}
