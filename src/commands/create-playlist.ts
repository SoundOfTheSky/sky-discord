import { ApplicationCommandOptionType } from 'discord.js';
import { Command } from './index.js';
import languages from '../assets/languages/index.js';
import { loadPreferences, savePreferences } from '../services/guilds.js';
import { guildPlayers } from '../player.js';

export default {
  name: 'create-playlist',
  description: 'cmdCreatePlaylistDescription',
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
    const player = guildPlayers.get(interaction.guildId!);
    if (!player) return languages[preferences.language].cmdCreatePlaylistErrorNotPlaying;
    if (!preferences.playlists) preferences.playlists = {};
    preferences.playlists[playlistName] = player.queue.map((x) => ({
      duration: x.duration,
      title: x.title,
      url: x.url,
    }));
    savePreferences(preferences);
  },
} as Command<[string]>;
