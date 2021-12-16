import Discord, { CategoryChannel, TextChannel, VoiceChannel } from 'discord.js';
import languages from '@/languages';
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
  for (const [, guild] of client.guilds.cache) {
    console.log('[LOADING] Guild: ' + guild.name);
    await client.updateGuildPreferences(guild).catch(e => console.error(e));
    await guild.commands.set(
      Object.values(commands).map(c => ({ ...c, description: languages[guild.preferences!.language][c.description] })),
    );
  }
  client.on('interactionCreate', async interaction => {
    if (!interaction.isCommand() || !interaction.guild) return;
    if (!interaction.guild.preferences) {
      interaction
        .reply("Server's settings isn't loaded. Wait a little.\nOr maybe bot just shat himself.")
        .catch(() => {});
      return;
    }
    const cmd = commands[interaction.commandName as keyof typeof commands];
    if (!cmd) return;
    const options: any[] = cmd.options!.map(option =>
      interaction.options[
        ('get' + (option.type as string)[0] + (option.type as string).slice(1).toLowerCase()) as 'get'
      ](option.name),
    );
    await interaction.deferReply({
      ephemeral: true,
    });
    if (
      await cmd.handler({
        options,
        interaction,
      })
    )
      await interaction.editReply('👌');
  });
  client.on('messageCreate', async msg => {
    try {
      if (msg.author.bot || msg.channel.type !== 'GUILD_TEXT') return;
      if (!msg.guild!.preferences) {
        msg.reply("Server's settings isn't loaded. Wait a little.\nOr maybe bot just shat himself.").catch(() => {});
        return;
      }
      if (!msg.mentions.has(client.user!) && !msg.content.startsWith(msg.guild!.preferences.prefix)) return;
      const message = msg.content.slice(msg.content.indexOf(' ') + 1);
      const msgSplit = message.split(' ');
      const cmd = commands[msgSplit[0] as keyof typeof commands];
      if (!cmd) return;
      msg.react('⏱').catch(() => {});
      if (
        await cmd.handler({
          options: msgSplit.slice(1).map((s, i) => {
            if (!cmd.options) return s;
            switch (cmd.options[i].type) {
              case 'BOOLEAN':
                return !s || s.toLocaleLowerCase() === 'false' || s.toLocaleLowerCase() === 'нет' ? false : true;
              case 'INTEGER':
              case 'NUMBER':
                return s ? +s : undefined;
              default:
                return s;
            }
          }),
          msg,
        })
      )
        msg.react('👌').catch(() => {});
      setTimeout(() => {
        msg.delete().catch(() => {});
      }, 5000);
    } catch {}
  });
  client.on('voiceStateUpdate', async (oldMember, newMember) => {
    if (newMember.member?.user.bot || oldMember.channelId === newMember.channelId) return;
    if (newMember.channelId) {
      const channel = newMember.guild.channels.cache.get(newMember.channelId)! as VoiceChannel;
      if (channel.parentId) {
        const category = newMember.guild.channels.cache.get(channel.parentId)! as CategoryChannel;
        if (
          category.name.startsWith('!') &&
          newMember.guild.channels.cache.find(c => c.parentId === channel.parentId)!.id === channel.id
        ) {
          try {
            const newChannel = await newMember.guild.channels.create(
              category.name.slice(1) +
                ' #' +
                newMember.guild.channels.cache.filter(c => c.parentId === category.id).size,
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
          } catch (e) {}
        }
      }
    }
    if (oldMember.channelId) {
      const channel = newMember.guild.channels.cache.get(oldMember.channelId) as VoiceChannel;
      const membersLeft = channel.members.filter(m => !m.user.bot).size;
      if (oldMember.guild.player && membersLeft === 0) oldMember.guild.player.destroy();
      if (
        channel.parentId &&
        membersLeft === 0 &&
        newMember.guild.channels.cache.get(channel.parentId)!.name.startsWith('!') &&
        newMember.guild.channels.cache.find(c => c.parentId === channel.parentId)!.id !== channel.id
      )
        channel.delete().catch(() => {});
    }
  });
  console.log('Ready!');
});
client.on('guildCreate', async guild => {
  try {
    await guild.channels.fetch();
    await client.updateGuildPreferences(guild);
    client.managerRequest('updateStatus()');
  } catch {
    await (guild.channels.cache.find(c => c.type === 'GUILD_TEXT') as TextChannel)
      ?.send(
        'I could not create settings channel and shat myself.\nMaybe you need to give me admin rights... Who knows?',
      )
      .catch(() => {});
    guild.leave();
  }
});
client.on('guildDelete', () => {
  client.managerRequest('updateStatus()');
});
client.login(process.env.TOKEN);
