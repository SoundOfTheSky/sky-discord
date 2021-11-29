import { Command } from '../interfaces';
import { GuildMember, TextChannel, VoiceChannel } from 'discord.js';
import { AudioPlayerStatus } from '@discordjs/voice';
import Player from '@/player';
import { Track } from '@/track';
const cmd: Command = {
  name: 'playlist',
  description: 'Запуск/просмотр/удаление плейлистов',
  options: [
    {
      name: 'paylist',
      description: 'Плейлист',
      type: 'STRING',
    },
    {
      name: 'delete',
      description: 'Удалить плейлист вместо того чтобы запустить',
      type: 'BOOLEAN',
    },
  ],
  async handler(data) {
    const member = data.interaction ? data.interaction.member : data.msg!.member!;
    const answer = (msg: string) =>
      data.interaction
        ? data.interaction.editReply(msg)
        : data
            .msg!.reply(msg)
            .then(msg => setTimeout(() => msg.delete().catch(() => {}), 5000))
            .catch(() => {});
    const textChannel = (data.interaction ? data.interaction.channel! : data.msg!.channel!) as TextChannel;
    if (!(member instanceof GuildMember)) {
      await answer('Мальчик, мы работаем только на сервере.');
      return false;
    }
    if (!data.options[0]) {
      await answer(
        Object.keys(member.guild.preferences.playlists)
          .map((p, i) => `${i + 1}. ${p} [${member.guild.preferences.playlists[p].length} треков]`)
          .join('\n'),
      );
      return false;
    } else if (data.options[0] in member.guild.preferences.playlists) {
      if (data.options[1]) {
        delete member.guild.preferences.playlists[data.options[0]];
        await client.setGuildPreferences(member.guild, member.guild.preferences);
      } else {
        if (!(member.voice.channel instanceof VoiceChannel)) {
          await answer('Ало? Куда присоединяться? Сначала сам зайди в канал.');
          return false;
        }
        if (!member.guild.player || member.guild.player.voiceChannel.id !== member.voice.channel.id) {
          new Player(member.guild, member.voice.channel, textChannel);
          await member.guild.player!.init();
        }
        const tracks = member.guild.preferences.playlists[data.options[0]].map(
          t => new Track({ ...t, cookie: member.guild.preferences.youtubeCookies }),
        );
        member.guild.player!.queue = tracks;
        member.guild.player!.queueIndex = -1;
        member.guild.player!.processQueue();
      }
    } else {
      await answer('Плейлиста с таким названием нету.');
      return false;
    }
    return true;
  },
};
export default cmd;
