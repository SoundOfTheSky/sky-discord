import { Command } from '../interfaces';
const cmd: Command = {
  name: 'prefix',
  description: 'Меняет префикс бота.',
  options: [
    {
      name: 'prefix',
      description: 'Новый перфикс',
      type: 'STRING',
    },
  ],
  async handler(data) {
    const guild = data.interaction ? data.interaction.guild : data.msg!.guild;
    console.log(!guild, data.options.length === 0, typeof data.options[0] !== 'string', data.options[0].length);
    if (
      !guild ||
      data.options.length === 0 ||
      typeof data.options[0] !== 'string' ||
      data.options[0].length === 0 ||
      data.options[0].length > 64
    )
      return;
    data.guildPreferences.Prefix = data.options[0];
    client.updateGuildPreferences(guild, data.guildPreferences);
  },
};
export default cmd;
