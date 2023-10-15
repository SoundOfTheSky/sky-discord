import { ApplicationCommandOptionType } from 'discord.js';
import languages from '../assets/languages/index.js';
import { Command } from './index.js';
import { loadPreferences, savePreferences } from '../services/guilds.js';

export default {
  name: 'youtube-cookie',
  description: 'cmdYouTubeCookieDescription',
  options: [
    {
      name: 'cookies',
      description: 'cmdYouTubeCookieOptionCookies',
      type: ApplicationCommandOptionType.String,
      required: true,
    },
  ],
  handler(interaction, cookies) {
    const preferences = loadPreferences(interaction.guildId!)!;
    if (cookies.length === 0 || cookies.length > 4096) return languages[preferences.language].cmdYouTubeCookieError;
    const splitCookie = cookies.split('; ');
    if (splitCookie.length < 2 || splitCookie.some((c) => !c.includes('=') || c.includes(':')))
      return languages[preferences.language].cmdYouTubeCookieError;
    preferences.youtubeCookies = cookies;
    savePreferences(preferences);
  },
} as Command<[string]>;
