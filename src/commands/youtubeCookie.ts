import { Command } from '../interfaces';
const cmd: Command = {
  name: 'youtube-cookie',
  description: 'Установить свои куки для ютуба. Позволяет включать гачи-ремиксы с возрастным ограничением.',
  options: [
    {
      name: 'cookies',
      description: 'коки',
      type: 'STRING',
      required: true,
    },
  ],
  async handler(data) {
    const guild = data.interaction ? data.interaction.guild : data.msg!.guild;
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
      data.options[0].length > 2048
    ) {
      await answer('Куки должен быть длиной от 1 до 1024 символов.');
      return false;
    }
    try {
      guild.preferences.youtubeCookies = data.options[0];
      await client.setGuildPreferences(guild, guild.preferences);
    } catch {
      await answer('Что-то пошло не так.');
      return false;
    }
    return true;
  },
};
export default cmd;
