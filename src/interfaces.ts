import Discord, {
  ApplicationCommandOptionData,
  ChatInputApplicationCommandData,
  CommandInteraction,
  Message,
} from 'discord.js';
import { TrackData } from '@/track';
import languages from '@/languages';
declare module 'discord.js' {
  export interface Client {
    commands: Discord.Collection<unknown, Command>;
  }
}
declare global {
  // eslint-disable-next-line no-var
  var client: Discord.Client<boolean>;
}
export type GuildPreferences = {
  prefix: string;
  language: keyof typeof languages;
  youtubeCookies: string;
  playlists: { [key: string]: TrackData[] };
};
export type Command = ChatInputApplicationCommandData & {
  description: keyof typeof languages.russian;
  options?: (ApplicationCommandOptionData & { description: keyof typeof languages.russian })[];
  handler: (data: { msg?: Message; interaction?: CommandInteraction; options: any[] }) => Promise<boolean>;
};
