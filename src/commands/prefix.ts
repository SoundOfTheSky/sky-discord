import { Command } from '../interfaces';
const cmd: Command = {
  name: 'prefix',
  description: 'Меняет префикс бота.',
  options: [
    {
      name: 'prefix',
      description: 'Новый перфикс',
      type: 'STRING',
      required: true,
    },
  ],
  async handler(data) {
    const guild = data.interaction ? data.interaction.guild : data.msg!.guild;
    if (
      !guild ||
      data.options.length === 0 ||
      typeof data.options[0] !== 'string' ||
      data.options[0].length === 0 ||
      data.options[0].length > 64
    )
      return false;
    data.guildPreferences.Prefix = data.options[0];
    client.updateGuildPreferences(guild, data.guildPreferences);
    return true;
  },
};
export default cmd;
