import { Command } from '../interfaces';
import languages from '@/languages';
const cmd: Command = {
  name: 'youtube-cookie',
  description: 'cmdYouTubeCookieDescription',
  options: [
    {
      name: 'cookies',
      description: 'cmdYouTubeCookieOptionCookies',
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
      data.options[0].length > 2048
    ) {
      await answer(languages[guild.preferences!.language].cmdYouTubeCookieError);
      return false;
    }
    const splitCookie = data.options[0].split('; ');
    if (splitCookie.length < 2 || splitCookie.some(c => c.split('=').length !== 2)) {
      await answer(languages[guild.preferences!.language].cmdYouTubeCookieError);
      return false;
    }
    try {
      guild.preferences!.youtubeCookies = data.options[0];
      await client.setGuildPreferences(guild, guild.preferences!);
    } catch {
      await answer('Что-то пошло не так.');
      return false;
    }
    return true;
  },
};
export default cmd;
