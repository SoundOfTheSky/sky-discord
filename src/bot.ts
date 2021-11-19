import Discord, { CategoryChannel, VoiceChannel } from 'discord.js';
import config from './config.json';
import commands from './commands';
const client = new Discord.Client({
  intents: [
    Discord.Intents.FLAGS.GUILDS,
    Discord.Intents.FLAGS.GUILD_MESSAGES,
    Discord.Intents.FLAGS.GUILD_VOICE_STATES,
    Discord.Intents.FLAGS.DIRECT_MESSAGES,
    Discord.Intents.FLAGS.GUILD_MESSAGE_REACTIONS,
    Discord.Intents.FLAGS.DIRECT_MESSAGE_REACTIONS,
    Discord.Intents.FLAGS.GUILD_INVITES,
    Discord.Intents.FLAGS.GUILD_INTEGRATIONS,
  ],
  partials: ['CHANNEL'],
});
global.client = client;
import './discordUtils';

client.once('ready', async () => {
  console.log('Logged in!');
  client.guilds.cache.each(guild => {
    guild.commands.set(Object.values(commands));
  });
});
client.commands = new Discord.Collection();
client.on('interactionCreate', async interaction => {
  if (interaction.isCommand()) {
    const cmd = commands[interaction.commandName as keyof typeof commands];
    if (!cmd || !interaction.guild) return;
    const guildPreferences = await client.getGuildPreferences(interaction.guild);
    const options: any[] = cmd.options!.map(option =>
      interaction.options[
        ('get' + (option.type as string)[0] + (option.type as string).slice(1).toLowerCase()) as 'get'
      ](option.name),
    );
    await interaction.deferReply({
      ephemeral: true,
    });
    const answer = await cmd.handler({
      guildPreferences,
      options,
      interaction,
    });
    await interaction.editReply(answer ?? '👌');
  }
});
client.on('messageCreate', async msg => {
  if (msg.author.bot) return;
  if (msg.channel.type === 'DM')
    await msg.author.send(
      'Invite link: ' +
        (await client.generateInvite({
          scopes: ['bot'],
          permissions: ['ADMINISTRATOR'],
        })),
    );
  else if (msg.channel.type === 'GUILD_TEXT') {
    const guildPreferences = await client.getGuildPreferences(msg.guild!);
    if (!msg.mentions.has(client.user!) && !msg.content.startsWith(guildPreferences.Prefix)) return;
    const message = msg.content.slice(msg.content.indexOf(' ') + 1);
    const msgSplit = message.split(' ');
    const cmd = commands[msgSplit[0] as keyof typeof commands];
    if (cmd) {
      await msg.react('⏱').catch(() => {});
      await cmd.handler({
        guildPreferences,
        options: msgSplit.slice(1),
        msg,
      });
      msg.react('👌').catch(() => {});
      msg.reactions.cache.first()?.remove();
    } else {
      await msg.react(':regional_indicator_k:').catch(() => {});
      await msg.react(':regional_indicator_a:').catch(() => {});
      await msg.react(':regional_indicator_w:').catch(() => {});
      await msg.react(':regional_indicator_o:').catch(() => {});
    }

    setTimeout(() => {
      msg.delete().catch(() => {});
    }, 30000);
  }
});
client.on('voiceStateUpdate', async (oldMember, newMember) => {
  if (newMember.member?.user.bot || oldMember.channelId === newMember.channelId) return;
  if (newMember.channelId) {
    const channel = newMember.guild.channels.cache.get(newMember.channelId)! as VoiceChannel;
    if (channel.parentId) {
      const category = newMember.guild.channels.cache.get(channel.parentId)! as CategoryChannel;
      if (
        !category.name.startsWith('!') ||
        newMember.guild.channels.cache.find(c => c.parentId === channel.parentId)!.id !== channel.id
      )
        return;
      const newChannel = await newMember.guild.channels.create(
        category.name.slice(1) + ' #' + newMember.guild.channels.cache.filter(c => c.parentId === category.id).size,
        {
          type: 'GUILD_VOICE',
          bitrate: channel.bitrate,
          userLimit: channel.userLimit,
          rtcRegion: channel.rtcRegion!,
          permissionOverwrites: channel.permissionOverwrites.cache.toJSON(),
          parent: category,
        },
      );
      await newMember.setChannel(newChannel);
    }
  }
  if (oldMember.channelId) {
    const channel = newMember.guild.channels.cache.get(oldMember.channelId) as VoiceChannel;
    if (
      !channel.parentId ||
      channel.members.size !== 0 ||
      !newMember.guild.channels.cache.get(channel.parentId)!.name.startsWith('!') ||
      newMember.guild.channels.cache.find(c => c.parentId === channel.parentId)!.id === channel.id
    )
      return;
    await channel.delete();
  }
});
client.on('guildCreate', async guild => {
  await guild.channels.fetch();
  await client.getGuildPreferences(guild);
});
client.login(config.token);
