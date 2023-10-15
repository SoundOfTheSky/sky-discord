import { ApplicationCommandOptionType } from 'discord.js';
import { Command } from './index.js';
import languages from '../assets/languages/index.js';
import { loadPreferences, savePreferences } from '../services/guilds.js';

export default {
  name: 'delete-playlist',
  description: 'cmdDeletePlaylistDescription',
  options: [
    {
      name: 'playlist',
      description: 'cmdPlaylistOptionPlaylist',
      type: ApplicationCommandOptionType.String,
      required: true,
    },
  ],
  handler(interaction, playlistName) {
    const preferences = loadPreferences(interaction.guildId!)!;
    const playlists = Object.keys(preferences.playlists ?? {});
    if (!preferences.playlists || playlists.length === 0)
      return languages[preferences.language].cmdPlaylistErrorNoPlaylists;
    if (playlistName in preferences.playlists) {
      // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
      delete preferences.playlists[playlistName];
      savePreferences(preferences);
    }
    return languages[preferences.language].cmdPlaylistErrorNotFound;
  },
} as Command<[string]>;
