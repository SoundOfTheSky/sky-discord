import { Command } from '../interfaces';
import languages from '@/languages';
const cmd: Command = {
  name: 'nickname',
  description: 'cmdNicknameDescription',
  options: [
    {
      name: 'name',
      description: 'cmdNicknameOptionName',
      type: 'STRING',
      required: true,
    },
  ],
  async handler(data) {
    const guild = data.interaction ? data.interaction.guild! : data.msg!.guild!;
    const answer = (msg: string) =>
      data.interaction
        ? data.interaction.editReply(msg)
        : data
            .msg!.reply(msg)
            .then(msg => setTimeout(() => msg.delete().catch(() => {}), 5000))
            .catch(() => {});
    if (
      !guild ||
      data.options.length === 0 ||
      typeof data.options[0] !== 'string' ||
      data.options[0].length === 0 ||
      data.options[0].length > 64
    ) {
      await answer(languages[guild.preferences!.language].cmdNicknameErrorNick);
      return false;
    }
    try {
      const member = await guild.members.fetch(client.user!);
      member.setNickname(data.options[0]);
      member.guild.preferences!.prefix = data.options[0];
      await client.setGuildPreferences(guild, member.guild.preferences!);
    } catch {
      await answer(languages[guild.preferences!.language].somethingWentWrong);
      return false;
    }
    return true;
  },
};
export default cmd;
