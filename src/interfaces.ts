import Discord, { ChatInputApplicationCommandData, Interaction, Message } from 'discord.js';
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
  Prefix: string;
};
export type Command = ChatInputApplicationCommandData & {
  handler: (data: {
    guildPreferences: GuildPreferences;
    msg?: Message;
    interaction?: Interaction;
    options: any[];
  }) => Promise<string | void>;
};
