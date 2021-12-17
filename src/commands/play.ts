import { Command } from '../interfaces';
import { GuildMember, TextChannel, VoiceChannel } from 'discord.js';
import Player from '@/player';
import { Track } from '@/track';
import languages from '@/languages';
const cmd: Command = {
  name: 'play',
  description: 'cmdPlayDescription',
  options: [
    {
      name: 'url',
      description: 'cmdPlayOptionURL',
      type: 'STRING',
      required: true,
    },
  ],
  async handler(data) {
    const member = data.interaction ? (data.interaction.member as GuildMember) : data.msg!.member!;
    const textChannel = (data.interaction ? data.interaction.channel! : data.msg!.channel!) as TextChannel;
    const answer = (msg: string) =>
      data.interaction
        ? data.interaction.editReply(msg)
        : data
            .msg!.reply(msg)
            .then(msg => setTimeout(() => msg.delete().catch(() => {}), 2500))
            .catch(() => {});
    if (!(member.voice.channel instanceof VoiceChannel)) {
      await answer(languages[member.guild.preferences!.language].cmdPlayErrorNoVoiceChannel);
      return false;
    }
    try {
      const tracks = await Track.from(data.options.join(' '), member.guild.preferences!.youtubeCookies);
      if (tracks.length === 0) {
        await answer(languages[member.guild.preferences!.language].cmdPlayErrorNoVoiceChannel);
        return false;
      }
      if (!member.guild.player || member.guild.player.voiceChannel.id !== member.voice.channel.id) {
        new Player(member.guild, member.voice.channel, textChannel);
        await member.guild.player!.init();
      }
      member.guild.player!.queue.push(...tracks);
      member.guild.player!.processQueue();
    } catch (e: any) {
      await answer(
        e.statusCode === 410
          ? languages[member.guild.preferences!.language].cmdPlayErrorVideoIsNotAvailable
          : '' + e || languages[member.guild.preferences!.language].somethingWentWrong,
      );
      return false;
    }
    return true;
  },
};
export default cmd;
