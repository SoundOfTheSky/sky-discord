import { ApplicationCommandOptionType } from 'discord.js';
import languages from '../assets/languages/index.js';
import { Command } from './index.js';
import { loadPreferences, savePreferences } from '../services/guilds.js';

export default {
  name: 'language',
  description: 'cmdLanguageDescription',
  options: [
    {
      name: 'lang',
      description: 'cmdLanguageOptionLang',
      type: ApplicationCommandOptionType.String,
      required: true,
    },
  ],
  handler(interaction, language) {
    if (!(language in languages)) return 'There is no such language.';
    const preferences = loadPreferences(interaction.guildId!)!;
    preferences.language = language as keyof typeof languages;
    savePreferences(preferences);
  },
} as Command<[string]>;
