import { Guild, MessageOptions, MessagePayload, TextChannel, Permissions } from 'discord.js';
import { GuildPreferences } from './interfaces';

const sendMsg = async (channel: TextChannel, data: string | MessagePayload | MessageOptions, deleteAfter?: number) =>
  new Promise(async r => {
    const msg = await channel.send(data).catch(() => {});
    r(msg);
    if (deleteAfter && deleteAfter > 0) setTimeout(() => msg!.delete().catch(() => {}), deleteAfter);
  });
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
    .map(op => op[0] + ': ' + (op[1] === true ? 'yes' : op[1] === false ? 'no' : op[1]))
    .join('\n');
}
async function getGuildPreferences(guild: Guild) {
  const defaultPreferencesMessage = 'Prefix: Sky\nDelete messages: yes';
  let preferencesChannel: TextChannel = guild.channels.cache.find(
    c => c.type === 'GUILD_TEXT' && c.name === 'sky-preferences',
  ) as TextChannel;
  if (!preferencesChannel) {
    preferencesChannel = await guild.channels.create('sky-preferences', {
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
  if (preferences.Prefix.length === 0 || preferences.Prefix.length > 64) {
    await preferencesChannel.send(defaultPreferencesMessage);
    await lastMsg.delete();
    preferences = parsePreferences(defaultPreferencesMessage);
  }
  return preferences;
}
async function updateGuildPreferences(guild: Guild, preferences: GuildPreferences) {
  const preferencesChannel: TextChannel = guild.channels.cache.find(
    c => c.type === 'GUILD_TEXT' && c.name === 'sky-preferences',
  ) as TextChannel;
  const lastMsg = await preferencesChannel.messages.fetch(preferencesChannel.lastMessageId!);
  await lastMsg.delete().catch(() => {});
  preferencesChannel.send(stringifyPreferences(preferences));
}
declare module 'discord.js' {
  export interface Client {
    sendMsg: typeof sendMsg;
    managerRequest: typeof managerRequest;
    strToEmojis: typeof strToEmojis;
    parsePreferences: typeof parsePreferences;
    stringifyPreferences: typeof stringifyPreferences;
    getGuildPreferences: typeof getGuildPreferences;
    updateGuildPreferences: typeof updateGuildPreferences;
  }
}
global.client.sendMsg = sendMsg;
global.client.managerRequest = managerRequest;
global.client.strToEmojis = strToEmojis;
global.client.parsePreferences = parsePreferences;
global.client.stringifyPreferences = stringifyPreferences;
global.client.getGuildPreferences = getGuildPreferences;
global.client.updateGuildPreferences = updateGuildPreferences;
