const Discord = require('discord.js');
const fs = require('fs/promises');
const config = require('./config.json');
const client = new Discord.Client({
  intents: [
    Discord.Intents.FLAGS.GUILDS,
    Discord.Intents.FLAGS.GUILD_MESSAGES,
    Discord.Intents.FLAGS.GUILD_VOICE_STATES,
  ],
});
global.client = client;
client.once('ready', async () => {
  console.log('Logged in!');
  // Load commands
  client.commands = (await fs.readdir(__dirname + '/commands')).map(module => require('./commands/' + module));
  client.on('messageCreate', async msg => {
    try {
      if (!msg.mentions.has(client.user) || msg.author.bot) return;
      const message = msg.content.slice(msg.content.indexOf(' ') + 1);
      msg.delete({ timeout: 60000 }).catch(() => {});
      const cmd = client.commands.find(c => c.names.some(n => message.startsWith(words[n])));
      if (cmd) cmd.handler(client, msg, gSettings, message.replace(words[cmd.name], '').trim());
      else if (msg.channel.type === 'dm')
        msg.author.send(
          'Invite me with a link to your server for more features: ' +
            (await client.generateInvite({
              permissions: ['ADMINISTRATOR'],
            })),
        );
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
});
client.login(config.token);
