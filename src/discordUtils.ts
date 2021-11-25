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
function parsePreferences(t: string): GuildPreferences {
  return Object.fromEntries(
    t.split('\n').map(row =>
      row
        .split(': ')
        .map(el => el.trim())
        .map(el => (el === 'yes' ? true : el === 'no' ? false : el)),
    ),
  );
}
function stringifyPreferences(p: GuildPreferences) {
  return Object.entries(p)
    .map(
      op =>
        op[0] +
        ': ' +
        ((op[1] as unknown as boolean) === true ? 'yes' : (op[1] as unknown as boolean) === false ? 'no' : op[1]),
    )
    .join('\n');
}
async function getGuildPreferences(guild: Guild) {
  const defaultPreferencesMessage = JSON.stringify({ prefix: 'randobot', playlists: [] });
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
  if (!preferencesChannel.lastMessageId) await preferencesChannel.send(defaultPreferencesMessage);
  const lastMsg = await preferencesChannel.messages.fetch(preferencesChannel.lastMessageId!);
  let preferences = parsePreferences(lastMsg.content);
  if (preferences.prefix.length === 0 || preferences.prefix.length > 64 || !Array.isArray(preferences.playlists)) {
    await preferencesChannel.send(defaultPreferencesMessage);
    await lastMsg.delete().catch(() => {});
    preferences = parsePreferences(defaultPreferencesMessage);
  }
  return preferences;
}
async function updateGuildPreferences(guild: Guild, preferences: GuildPreferences) {
  const preferencesChannel: TextChannel = guild.channels.cache.find(
    c => c.type === 'GUILD_TEXT' && c.name === 'randobot-preferences',
  ) as TextChannel;
  const lastMsg = await preferencesChannel.messages.fetch(preferencesChannel.lastMessageId!);
  await lastMsg.delete().catch(() => {});
  preferencesChannel.send(stringifyPreferences(preferences));
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
    stringifyPreferences: typeof stringifyPreferences;
    getGuildPreferences: typeof getGuildPreferences;
    updateGuildPreferences: typeof updateGuildPreferences;
    awaitMessage: typeof awaitMessage;
  }
  export interface Guild {
    player?: Player;
  }
}
global.client.managerRequest = managerRequest;
global.client.strToEmojis = strToEmojis;
global.client.parsePreferences = parsePreferences;
global.client.stringifyPreferences = stringifyPreferences;
global.client.getGuildPreferences = getGuildPreferences;
global.client.updateGuildPreferences = updateGuildPreferences;
global.client.awaitMessage = awaitMessage;
