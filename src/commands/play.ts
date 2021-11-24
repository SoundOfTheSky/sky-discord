import { Command } from '../interfaces';
import { GuildMember, TextChannel, VoiceChannel } from 'discord.js';
import Player from '@/player';
import { Track } from '@/track';
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
    const url = data.options[0] as string;
    const member = data.interaction ? data.interaction.member : data.msg!.member!;
    const textChannel = (data.interaction ? data.interaction.channel! : data.msg!.channel!) as TextChannel;
    if (!(member instanceof GuildMember)) return 'Мальчик, мы работаем только на сервере.';
    if (!(member.voice.channel instanceof VoiceChannel)) return 'Ало? Куда присоединяться? Сначала сам зайди в канал.';
    if (!url.startsWith('https://youtube.com/v?')) return 'Музяка пока поддерживается только ЮТуба.';
    if (!member.guild.player) {
      new Player(member.guild, member.voice.channel, textChannel);
      await member.guild.player!.init();
    }
    member.guild.player!.queue.push(await Track.fromYouTube(data.options[0]));
    member.guild.player!.processQueue();
    return;
  },
};
export default cmd;
