import { Guild, TextChannel, Permissions, Message, Collection } from 'discord.js';
import { GuildPreferences } from './interfaces';
import Player from './player';

const managerRequest = (code: string) =>
  new Promise(r => {
    const id = Math.random().toString(36).slice(2);
    global.client.shard!.send([id, code]);
    function onMessage(data: [string, any]) {
      if (data[0] !== id) return;
      process.removeListener('message', onMessage);
      r(data[1]);
    }
    process.on('message', onMessage);
  });
function parsePreferences(t: string): GuildPreferences | false {
  try {
    return JSON.parse(t);
  } catch {
    return false;
  }
}
async function updateGuildPreferences(guild: Guild) {
  const defaultPreferences = { prefix: guild.me?.displayName ?? 'randobot', playlists: {}, youtubeCookies: '' };
  let preferencesChannel: TextChannel = guild.channels.cache.find(
    c => c.type === 'GUILD_TEXT' && c.name === 'randobot-preferences',
  ) as TextChannel;
  if (!preferencesChannel)
    preferencesChannel = await guild.channels.create('randobot-preferences', {
      permissionOverwrites: [
        {
          type: 'role',
          id: guild.roles.everyone,
          deny: [Permissions.FLAGS.VIEW_CHANNEL],
        },
        {
          type: 'member',
          id: client.user!.id,
          allow: [Permissions.FLAGS.VIEW_CHANNEL],
        },
      ],
    });
  const msgs = await preferencesChannel.messages.fetch({ limit: 100 }).catch(() => {});
  const preferences = msgs
    ? parsePreferences(
        msgs
          .map(m => m.content)
          .reverse()
          .join(''),
      )
    : false;
  if (
    preferences === false ||
    preferences.prefix.length === 0 ||
    preferences.prefix.length > 64 ||
    typeof preferences.playlists !== 'object'
  )
    await setGuildPreferences(guild, defaultPreferences, preferencesChannel, msgs ? msgs : undefined);
  else guild.preferences = preferences as GuildPreferences;
}
async function setGuildPreferences(
  guild: Guild,
  preferences: GuildPreferences,
  preferencesChannel?: TextChannel,
  msgs?: Collection<string, Message<boolean>>,
) {
  try {
    if (!preferencesChannel)
      preferencesChannel = guild.channels.cache.find(
        c => c.type === 'GUILD_TEXT' && c.name === 'randobot-preferences',
      ) as TextChannel;
    const text = JSON.stringify(preferences);
    if (text.length > 200000) return;
    guild.preferences = undefined;
    if (!msgs) msgs = await preferencesChannel.messages.fetch({ limit: 100 });
    for (const [, msg] of msgs) await msg.delete();
    for (let i = 0; i < 100; i++) {
      if (text.length <= i * 2000) break;
      await preferencesChannel.send(text.slice(i * 2000, (i + 1) * 2000));
    }
    guild.preferences = preferences;
  } catch (e) {
    console.error(e);
  }
}
declare module 'discord.js' {
  export interface Client {
    managerRequest: typeof managerRequest;
    parsePreferences: typeof parsePreferences;
    updateGuildPreferences: typeof updateGuildPreferences;
    setGuildPreferences: typeof setGuildPreferences;
  }
  export interface Guild {
    player?: Player;
    preferences?: GuildPreferences;
  }
}
global.client.managerRequest = managerRequest;
global.client.parsePreferences = parsePreferences;
global.client.updateGuildPreferences = updateGuildPreferences;
global.client.setGuildPreferences = setGuildPreferences;
