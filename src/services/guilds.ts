import { writeFileSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';

import { TrackData } from './track.js';
import languages from '../assets/languages/index.js';

export type GuildPreferences = {
  id: string;
  language: keyof typeof languages;
  youtubeCookies?: string;
  playlists?: { [key: string]: TrackData[] };
};

export function savePreferences(preferences: GuildPreferences) {
  writeFileSync(join('guilds', preferences.id), JSON.stringify(preferences, undefined, 2), 'utf8');
}

export function loadPreferences(id: string) {
  const path = join('guilds', id);
  if (!existsSync(path)) return;
  return JSON.parse(readFileSync(path, 'utf8')) as GuildPreferences;
}
