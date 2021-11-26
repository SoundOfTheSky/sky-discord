import Discord, { ChatInputApplicationCommandData, CommandInteraction, Message } from 'discord.js';
declare module 'discord.js' {
  export interface Client {
    commands: Discord.Collection<unknown, Command>;
  }
  export interface Command {
    name: string;
    description: string;
    execute: (message: Message, args: string[]) => void;
  }
}
declare global {
  // eslint-disable-next-line no-var
  var client: Discord.Client<boolean>;
}
export type GuildPreferences = {
  prefix: string;
  playlists: { [key: string]: { title: string; id: string }[] };
};
export type Command = ChatInputApplicationCommandData & {
  handler: (data: { msg?: Message; interaction?: CommandInteraction; options: any[] }) => Promise<boolean>;
};
