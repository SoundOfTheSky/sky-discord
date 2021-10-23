const Discord = require('discord.js');
const fs = require('fs/promises');
const config = require('./config.json');
const client = new Discord.Client({
  intents: [
    Discord.Intents.FLAGS.GUILDS,
    Discord.Intents.FLAGS.GUILD_MESSAGES,
    Discord.Intents.FLAGS.GUILD_VOICE_STATES,
    Discord.Intents.FLAGS.DIRECT_MESSAGES,
    Discord.Intents.FLAGS.GUILD_MESSAGE_REACTIONS,
    Discord.Intents.FLAGS.DIRECT_MESSAGE_REACTIONS,
    Discord.Intents.FLAGS.GUILD_INVITES,
  ],
  partials: ['CHANNEL'],
});
require('./discordUtils')(client);
global.client = client;
async function getGuildPreferences(guild) {
  const defaultPreferencesMessage = 'Prefix: Sky\nDelete messages: yes';
  let preferencesChannel = guild.channels.cache.find(c => c.type === 'GUILD_TEXT' && c.name === 'sky-preferences');
  if (!preferencesChannel) {
    preferencesChannel = await guild.channels.create('sky-preferences', {
      permissionOverwrites: [
        {
          type: 'role',
          id: guild.roles.everyone,
          deny: [Discord.Permissions.FLAGS.VIEW_CHANNEL],
        },
        {
          type: 'member',
          id: client.user.id,
          allow: [Discord.Permissions.FLAGS.VIEW_CHANNEL],
        },
      ],
    });
    preferencesChannel.send(
      '======\nThis is a PRIVATE channel dedicated to SkyBot configuration.\nTo change preferences:\n1. Copy last configuration.\n2. Make changes.\n3. Send it here. Bot will automatically hook it up.\n======',
    );
  }
  if (!preferencesChannel.lastMessageId) await preferencesChannel.send(defaultPreferencesMessage);
  const lastMsg = await preferencesChannel.messages.fetch(preferencesChannel.lastMessageId);
  let preferences = Object.fromEntries(lastMsg.content.split('\n').map(row => row.split(': ').map(el => el.trim())));
  if (
    preferences.Prefix.length === 0 ||
    preferences.Prefix.length > 64 ||
    !['yes', 'no'].includes(preferences['Delete messages'].toLowerCase())
  ) {
    await preferencesChannel.send('There was an error in your configuration.\nConfiguration was reset to default.');
    await preferencesChannel.send(defaultPreferencesMessage);
    await lastMsg.delete();
    preferences = Object.fromEntries(
      defaultPreferencesMessage.split('\n').map(row => row.split(': ').map(el => el.trim())),
    );
  }
  return preferences;
}
client.once('ready', async () => {
  console.log('Logged in!');
  // Load commands
  client.commands = (await fs.readdir(__dirname + '/commands')).map(module => require('./commands/' + module));
  client.on('messageCreate', async msg => {
    if (msg.author.bot) return;
    try {
      if (msg.channel.type === 'DM')
        await msg.author.send(
          'Invite link: ' +
            (await client.generateInvite({
              scopes: ['bot'],
              permissions: ['ADMINISTRATOR'],
            })),
        );
      else if (msg.channel.type === 'GUILD_TEXT') {
        if (msg.channel.name === 'sky-preferences') {
          await getGuildPreferences(msg.guild);
          return msg.react('👌').catch(() => {});
        }
        if (!msg.mentions.has(client.user)) return;
        msg.react('👌').catch(() => {});
        const preferences = await getGuildPreferences(msg.guild);
        const message = msg.content.slice(msg.content.indexOf(' ') + 1);
        const cmd = client.commands.find(c => c.names.some(n => message.startsWith(n)));
        if (cmd) cmd.handler(client, msg, preferences);
        else console.log('a');
        if (preferences['Delete messages'].toLowerCase() === 'yes') msg.delete().catch(() => {});
      }
    } catch (e) {
      console.error(e, e.message);
    }
  });
  client.on('voiceStateUpdate', async (oldMember, newMember) => {
    if (newMember.member.user.bot || oldMember.channelId === newMember.channelId) return;
    if (newMember.channelId) {
      const channel = newMember.guild.channels.cache.get(newMember.channelId);
      if (channel.parentId) {
        const category = newMember.guild.channels.cache.get(channel.parentId);
        if (category.name.startsWith('!') && channel.rawPosition === 1) {
          let userLimit;
          const bracketI = category.name.indexOf('[');
          if (bracketI !== -1 && /^.+\[\d+\]$/.test(category.name)) userLimit = +category.name.slice(bracketI + 1, -1);
          const newChannel = await newMember.guild.channels.create(
            category.name.slice(1, bracketI === -1 ? undefined : bracketI) +
              ' #' +
              newMember.guild.channels.cache.filter(c => c.parentId === category.id).size,
            {
              type: 'GUILD_VOICE',
              userLimit,
              parent: category,
            },
          );
          await newMember.setChannel(newChannel);
        }
      }
    }
    if (oldMember.channelId) {
      const channel = newMember.guild.channels.cache.get(oldMember.channelId);
      if (
        channel.parentId &&
        channel.members.size === 0 &&
        channel.rawPosition !== 1 &&
        newMember.guild.channels.cache.get(channel.parentId).name.startsWith('!')
      )
        await channel.delete();
    }
  });
  client.on('guildCreate', async guild => {
    await guild.channels.fetch();
    getGuildPreferences(guild);
  });
});
client.login(config.token);
