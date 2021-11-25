import { Command } from '../interfaces';
const cmd: Command = {
  name: 'nickname',
  description: 'Меняет ник и префикс бота.',
  options: [
    {
      name: 'name',
      description: 'Новый ник',
      type: 'STRING',
      required: true,
    },
  ],
  async handler(data) {
    const guild = data.interaction ? data.interaction.guild : data.msg!.guild;
    const answer = (msg: string) => (data.interaction ? data.interaction.editReply(msg) : data.msg!.reply(msg));
    if (
      !guild ||
      data.options.length === 0 ||
      typeof data.options[0] !== 'string' ||
      data.options[0].length === 0 ||
      data.options[0].length > 64
    ) {
      await answer('Ник должен быть длиной от 1 до 64 символов.');
      return false;
    }
    try {
      const member = await guild.members.fetch(client.user!);
      await member.setNickname(data.options[0]);
      data.guildPreferences.prefix = data.options[0];
      await client.updateGuildPreferences(guild, data.guildPreferences);
    } catch {
      await answer('Что-то пошло не так.');
      return false;
    }
    return true;
  },
};
export default cmd;
