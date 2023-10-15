import { ActivityType, CategoryChannel, ChannelType, Client, Partials, TextChannel, VoiceChannel } from 'discord.js';
import { log, noop } from './utils/index.js';
import { commands } from '../commands/index.js';
import languages from '../assets/languages/index.js';
import { guildPlayers } from '../player.js';
import { loadPreferences, savePreferences } from './guilds.js';

export const client = new Client({
  intents: [
    'Guilds',
    'GuildMessages',
    'GuildVoiceStates',
    'DirectMessages',
    'GuildMessageReactions',
    'DirectMessageReactions',
    'GuildInvites',
    'GuildIntegrations',
  ],
  partials: [Partials.Channel],
});

client.once('ready', async () => {
  for (const [, guild] of client.guilds.cache) {
    log('[LOADING] Guild: ' + guild.name);
    await guild.channels.fetch();
    let preferences = loadPreferences(guild.id);
    if (!preferences) {
      preferences = {
        id: guild.id,
        language: 'english',
      };
      savePreferences(preferences);
    }
    await guild.commands.set(
      Object.values(commands).map((c) => ({ ...c, description: languages[preferences!.language][c.description] })),
    );
  }
  log('Ready!');
});
client.on('voiceStateUpdate', async (oldMember, newMember) => {
  if (newMember.member?.user.bot || oldMember.channelId === newMember.channelId) return;
  if (newMember.channelId) {
    const channel = newMember.guild.channels.cache.get(newMember.channelId)! as VoiceChannel;
    if (channel.parentId) {
      const category = newMember.guild.channels.cache.get(channel.parentId)! as CategoryChannel;
      if (
        category.name.startsWith('!') &&
        newMember.guild.channels.cache.find((c) => c.parentId === channel.parentId)!.id === channel.id
      ) {
        try {
          const newChannel = await newMember.guild.channels.create({
            name:
              category.name.slice(1) +
              ' #' +
              newMember.guild.channels.cache.filter((c) => c.parentId === category.id).size,
            type: ChannelType.GuildVoice,
            bitrate: channel.bitrate,
            userLimit: channel.userLimit,
            rtcRegion: channel.rtcRegion!,
            permissionOverwrites: channel.permissionOverwrites.cache.toJSON(),
            parent: category,
          });
          await newMember.setChannel(newChannel);
        } catch (e) {}
      }
    }
  }
  if (oldMember.channelId) {
    const channel = newMember.guild.channels.cache.get(oldMember.channelId) as VoiceChannel;
    const membersLeft = channel.members.filter((m) => !m.user.bot).size;
    if (membersLeft === 0) {
      void guildPlayers.get(channel.guildId)?.destroy();
      if (
        channel.parentId &&
        channel.guild.channels.cache.get(channel.parentId)!.name.startsWith('!') &&
        // TODO: Wtf is this?
        channel.guild.channels.cache.find((c) => c.parentId === channel.parentId)!.id !== channel.id
      )
        await channel.delete().catch(noop);
    }
  }
});
client.on('guildCreate', async (guild) => {
  try {
    await guild.channels.fetch();
    let preferences = loadPreferences(guild.id);
    if (!preferences) {
      preferences = {
        id: guild.id,
        language: 'english',
      };
      savePreferences(preferences);
    }
    updateStatus();
  } catch {
    await (guild.channels.cache.find((c) => c.type === ChannelType.GuildText) as TextChannel)
      ?.send(
        'I could not create settings channel and shat myself.\nMaybe you need to give me admin rights... Who knows?',
      )
      .catch(noop);
    await guild.leave();
  }
});
client.on('guildDelete', () => {
  updateStatus();
});
void client.login(process.env.DISCORD_TOKEN);

function updateStatus() {
  client.user!.setActivity(`${client.guilds.cache.size} servers`, { type: ActivityType.Listening });
}
