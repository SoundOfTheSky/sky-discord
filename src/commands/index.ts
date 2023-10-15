import { ApplicationCommandOptionData, ChatInputApplicationCommandData, CommandInteraction } from 'discord.js';

import languages from '../assets/languages/index.js';
import leave from './leave.js';
import language from './language.js';
import stop from './stop.js';
import youtubeCookie from './youtubeCookie.js';
import play from './play.js';
import playlist from './playlist.js';
import deletePlaylist from './delete-playlist.js';
import { client } from '../services/client.js';
import createPlaylist from './create-playlist.js';

type Option = ApplicationCommandOptionData & { description: keyof typeof languages.russian; required?: boolean };

export type Command<T extends (string | boolean | undefined)[] = []> = ChatInputApplicationCommandData & {
  options?: Option[];
  description: keyof typeof languages.russian;
  handler: (interaction: CommandInteraction, ...options: T) => unknown;
};

export const commands = {
  leave,
  play,
  playlist,
  'delete-playlist': deletePlaylist,
  'create-playlist': createPlaylist,
  stop,
  language,
  'youtube-cookie': youtubeCookie,
};

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isCommand() || !interaction.guild) return;
  const cmd = commands[interaction.commandName as keyof typeof commands];
  if (!cmd) return;
  await interaction.deferReply({
    ephemeral: true,
  });
  try {
    const args = (cmd.options ?? []).map((x) => interaction.options.get(x.name, (x as Option).required)?.value);
    const result = await (cmd as Command).handler(interaction, ...(args as []));
    await interaction.editReply(typeof result === 'string' ? result : '👌');
  } catch (e) {
    await interaction.editReply(e ?? '💀');
  }
});
