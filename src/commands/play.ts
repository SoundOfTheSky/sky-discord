import { ApplicationCommandOptionType, GuildMember, VoiceChannel } from 'discord.js';
import languages from '../assets/languages/index.js';
import { Command } from './index.js';
import Player, { guildPlayers } from '../player.js';
import { loadPreferences } from '../services/guilds.js';
import { Track } from '../services/track.js';

export default {
  name: 'play',
  description: 'cmdPlayDescription',
  options: [
    {
      name: 'url',
      description: 'cmdPlayOptionURL',
      type: ApplicationCommandOptionType.String,
      required: true,
    },
  ],
  async handler(interaction, url) {
    const preferences = loadPreferences(interaction.guildId!)!;
    const member = interaction.member as GuildMember;
    const textChannel = interaction.channel!;
    if (!(member.voice.channel instanceof VoiceChannel))
      return languages[preferences.language].cmdPlayErrorNoVoiceChannel;
    try {
      const tracks = await Track.from(url, preferences.youtubeCookies);
      if (tracks.length === 0) return languages[preferences.language].cmdPlayErrorShittyLink;
      let player = guildPlayers.get(member.guild.id);
      if (!player) player = await new Player(member.guild, preferences, member.voice.channel, textChannel).init();
      player.queue.push(...tracks);
      await player.processQueue();
    } catch (e: unknown) {
      return e && typeof e === 'object' && 'statusCode' in e && e.statusCode === 410
        ? languages[preferences.language].cmdPlayErrorVideoIsNotAvailable
        : e instanceof Error
        ? e
        : languages[preferences.language].somethingWentWrong;
    }
    return true;
  },
} as Command<[string]>;
