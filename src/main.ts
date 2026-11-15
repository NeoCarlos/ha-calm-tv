import './style.css';
import { CalmTv } from './app';
import { startDoorbellOnly } from './doorbell';
import { loadConfig, settings, haPath } from './config';
import { loadHome } from './home-data';
import { loadApps } from './apps';
import { wallpapers } from './wallpapers';
import { videos } from './videos';
import { showSetup } from './setup';

async function main(): Promise<void> {
  // Everything specific to a home comes from calm-tv.json (see config.ts).
  await loadConfig();
  loadHome();
  loadApps();
  const bg = settings.config.backgrounds;
  bg?.photos?.forEach((p) => wallpapers.push({ name: p.name, url: haPath(p.url) }));
  bg?.videos?.forEach((v) => videos.push({ name: v.name, url: haPath(v.url), thumb: v.thumb ? haPath(v.thumb) : '' }));

  if (new URLSearchParams(location.search).has('doorbell')) {
    startDoorbellOnly();
    return;
  }
  new CalmTv().start();
  if (!settings.haUrl) showSetup({ canCancel: false });
}

void main();
