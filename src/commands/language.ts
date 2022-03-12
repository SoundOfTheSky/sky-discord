import { Command } from '@/interfaces';
import languages from '@/languages';
const cmd: Command = {
  name: 'language',
  description: 'cmdLanguageDescription',
  options: [
    {
      name: 'lang',
      description: 'cmdLanguageOptionLang',
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
      data.options.length === 0 ||
      typeof data.options[0] !== 'string' ||
      data.options[0].length === 0 ||
      data.options[0].length > 16 ||
      !(data.options[0] in languages)
    ) {
      await answer('There are no such language.');
      return false;
    }
    try {
      guild.preferences!.language = data.options[0] as keyof typeof languages;
      await client.setGuildPreferences(guild, guild.preferences!);
    } catch {
      await answer('Something went terribly wrong and the bot is shit.');
      return false;
    }
    return true;
  },
};
export default cmd;
