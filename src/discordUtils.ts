import { Guild, TextChannel, Permissions, Message } from 'discord.js';
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
const strToEmojis = (n: string) =>
  (n + '')
    .split('')
    .reduce(
      (a, b) =>
        a +
        (isNaN(+b)
          ? `:regional_indicator_${b}:`
          : [':zero:', ':one:', ':two:', ':three:', ':four:', ':five:', ':six:', ':seven:', ':eight:', ':nine:'][+b]),
      '',
    );
function parsePreferences(t: string): GuildPreferences | false {
  try {
    return JSON.parse(t);
  } catch {
    return false;
  }
}
async function updateGuildPreferences(guild: Guild) {
  const defaultPreferencesMessage = JSON.stringify({ prefix: guild.me?.displayName, playlists: {} }, undefined, 2);
  let preferencesChannel: TextChannel = guild.channels.cache.find(
    c => c.type === 'GUILD_TEXT' && c.name === 'randobot-preferences',
  ) as TextChannel;
  if (!preferencesChannel) {
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
    preferencesChannel.send(
      'Это приватный канал, созданный для хранения настроек бота Randobot.\nТут нельзя ничего менять!\n=====\n',
    );
  }
  let lastMsg: Message | undefined;
  if (!preferencesChannel.lastMessageId) await preferencesChannel.send(defaultPreferencesMessage);
  try {
    if (!lastMsg) lastMsg = await preferencesChannel.messages.fetch(preferencesChannel.lastMessageId!);
  } catch {
    lastMsg = await preferencesChannel.send(defaultPreferencesMessage);
  }
  let preferences = parsePreferences(lastMsg.content);
  if (
    preferences === false ||
    preferences.prefix.length === 0 ||
    preferences.prefix.length > 64 ||
    typeof preferences.playlists !== 'object'
  ) {
    await preferencesChannel.send(defaultPreferencesMessage);
    await lastMsg.delete().catch(() => {});
    preferences = parsePreferences(defaultPreferencesMessage);
  }
  guild.preferences = preferences as GuildPreferences;
}
async function setGuildPreferences(guild: Guild, preferences: GuildPreferences) {
  const preferencesChannel: TextChannel = guild.channels.cache.find(
    c => c.type === 'GUILD_TEXT' && c.name === 'randobot-preferences',
  ) as TextChannel;
  const lastMsg = await preferencesChannel.messages.fetch(preferencesChannel.lastMessageId!);
  await lastMsg.delete().catch(() => {});
  await preferencesChannel?.send(JSON.stringify(preferences, undefined, 2));
  guild.preferences = preferences;
}
const awaitMessage = async (filter: (msg: Message) => boolean, timeout = 60000): Promise<Message> =>
  new Promise((r, j) => {
    if (!global.client.awaitingMessages) global.client.awaitingMessages = [];
    const timer = setTimeout(() => {
      global.client.awaitingMessages!.splice(global.client.awaitingMessages!.indexOf(filterWrapper), 1);
      j();
    }, timeout);
    global.client.awaitingMessages.push(filterWrapper);
    function filterWrapper(msg: Message) {
      if (filter(msg)) {
        clearTimeout(timer);
        global.client.awaitingMessages!.splice(global.client.awaitingMessages!.indexOf(filterWrapper), 1);
        r(msg);
      }
    }
  });
declare module 'discord.js' {
  export interface Client {
    awaitingMessages?: ((msg: Message) => void)[];
    managerRequest: typeof managerRequest;
    strToEmojis: typeof strToEmojis;
    parsePreferences: typeof parsePreferences;
    updateGuildPreferences: typeof updateGuildPreferences;
    setGuildPreferences: typeof setGuildPreferences;
    awaitMessage: typeof awaitMessage;
  }
  export interface Guild {
    player?: Player;
    preferences: GuildPreferences;
  }
}
global.client.managerRequest = managerRequest;
global.client.strToEmojis = strToEmojis;
global.client.parsePreferences = parsePreferences;
global.client.updateGuildPreferences = updateGuildPreferences;
global.client.setGuildPreferences = setGuildPreferences;
global.client.awaitMessage = awaitMessage;
