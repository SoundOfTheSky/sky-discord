import { ApplicationCommandOptionType, GuildMember, VoiceChannel } from 'discord.js';
import { Command } from './index.js';
import { loadPreferences } from '../services/guilds.js';
import languages from '../assets/languages/index.js';
import { Track } from '../services/track.js';
import Player, { guildPlayers } from '../player.js';

export default {
  name: 'playlist',
  description: 'cmdPlaylistDescription',
  options: [
    {
      name: 'playlist',
      description: 'cmdPlaylistOptionPlaylist',
      type: ApplicationCommandOptionType.String,
    },
  ],
  async handler(interaction, playlistName) {
    const textChannel = interaction.channel!;
    const preferences = loadPreferences(interaction.guildId!)!;
    const playlists = Object.keys(preferences.playlists ?? {});
    const member = interaction.member as GuildMember;
    if (!preferences.playlists || playlists.length === 0)
      return languages[preferences.language].cmdPlaylistErrorNoPlaylists;
    if (!playlistName) {
      return playlists
        .map((p, i) =>
          languages[preferences.language].cmdPlaylistAnswer
            .replace('{number}', i + 1 + '')
            .replace('{title}', p)
            .replace('{amount}', preferences.playlists![p].length + ''),
        )
        .join('\n');
    } else if (playlistName in preferences.playlists) {
      if (!(member.voice.channel instanceof VoiceChannel))
        return languages[preferences.language].cmdPlayErrorNoVoiceChannel;
      const tracks = preferences.playlists[playlistName].map((t) => new Track(t));
      let player = guildPlayers.get(member.guild.id);
      if (!player) player = await new Player(member.guild, preferences, member.voice.channel, textChannel).init();
      player.queue = tracks;
      player.queueIndex = -1;
      await player.processQueue();
    }
    return languages[preferences.language].cmdPlaylistErrorNotFound;
  },
} as Command<[string | undefined]>;
