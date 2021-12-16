import { Command } from '../interfaces';
import { getVoiceConnection } from '@discordjs/voice';
const cmd: Command = {
  name: 'leave',
  description: 'cmdLeaveDescription',
  async handler(data) {
    const guild = data.interaction ? data.interaction.guild! : data.msg!.guild!;
    getVoiceConnection(guild.id)?.destroy();
    return true;
  },
};
export default cmd;
