import { Command } from '../interfaces';
import { GuildMember } from 'discord.js';
import { getVoiceConnection } from '@discordjs/voice';
const cmd: Command = {
  name: 'leave',
  description: 'Прогнать бота из канала',
  async handler(data) {
    const member = data.interaction ? data.interaction.member : data.msg!.member!;
    const answer = (msg: string) => (data.interaction ? data.interaction.editReply(msg) : data.msg!.reply(msg));
    if (!(member instanceof GuildMember)) {
      await answer('Мальчик, мы работаем только на сервере.');
      return false;
    }
    getVoiceConnection(member.guild.id)?.destroy();
    return true;
  },
};
export default cmd;
