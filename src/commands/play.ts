import { Command } from '../interfaces';
import { GuildMember, TextChannel, VoiceChannel } from 'discord.js';
import Player from '@/player';
import { Track } from '@/track';
import { AudioPlayerStatus } from '@discordjs/voice';
const cmd: Command = {
  name: 'play',
  description: 'Запустить музяку',
  options: [
    {
      name: 'url',
      description: 'Ссылка',
      type: 'STRING',
      required: true,
    },
  ],
  async handler(data) {
    const member = data.interaction ? data.interaction.member : data.msg!.member!;
    const textChannel = (data.interaction ? data.interaction.channel! : data.msg!.channel!) as TextChannel;
    const answer = (msg: string) =>
      data.interaction
        ? data.interaction.editReply(msg)
        : data
            .msg!.reply(msg)
            .then(msg => setTimeout(() => msg.delete().catch(() => {}), 2500))
            .catch(() => {});
    if (!(member instanceof GuildMember)) {
      await answer('Мальчик, мы работаем только на сервере.');
      return false;
    }
    if (!(member.voice.channel instanceof VoiceChannel)) {
      await answer('Ало? Куда присоединяться? Сначала сам зайди в канал.');
      return false;
    }
    try {
      const tracks = await Track.from(data.options.join(' '), member.guild.preferences.youtubeCookies);
      if (tracks.length === 0) {
        await answer('Где ты эту ссылку взял?\nТы бы мне еще консервных банок приволок.');
        return false;
      }
      if (!member.guild.player || member.guild.player.voiceChannel.id !== member.voice.channel.id) {
        new Player(member.guild, member.voice.channel, textChannel);
        await member.guild.player!.init();
      }
      member.guild.player!.queue.push(...tracks);
      member.guild.player!.processQueue();
    } catch (e) {
      await answer('' + e ?? 'Что-то пошло не так хз что отстаньте.');
      return false;
    }
    return true;
  },
};
export default cmd;
