import { Command } from '../interfaces';
import { GuildMember, TextChannel, VoiceChannel } from 'discord.js';
import Player from '@/player';
import { Track } from '@/track';
import languages from '@/languages';
const cmd: Command = {
  name: 'playlist',
  description: 'cmdPlaylistDescription',
  options: [
    {
      name: 'playlist',
      description: 'cmdPlaylistOptionPlaylist',
      type: 'STRING',
    },
    {
      name: 'delete',
      description: 'cmdPlaylistOptionDelete',
      type: 'BOOLEAN',
    },
  ],
  async handler(data) {
    const member = data.interaction ? (data.interaction.member as GuildMember) : data.msg!.member!;
    const answer = (msg: string) =>
      data.interaction
        ? data.interaction.editReply(msg)
        : data
            .msg!.reply(msg)
            .then(msg => setTimeout(() => msg.delete().catch(() => {}), 5000))
            .catch(() => {});
    const textChannel = (data.interaction ? data.interaction.channel! : data.msg!.channel!) as TextChannel;
    if (!data.options[0]) {
      await answer(
        Object.keys(member.guild.preferences!.playlists)
          .map((p, i) =>
            languages[member.guild.preferences!.language].cmdPlaylistAnswer
              .replace('{number}', i + 1 + '')
              .replace('{title}', p)
              .replace('{amount}', member.guild.preferences!.playlists[p].length + ''),
          )
          .join('\n'),
      );
      return false;
    } else if (data.options[0] in member.guild.preferences!.playlists) {
      if (data.options[1]) {
        delete member.guild.preferences!.playlists[data.options[0]];
        await client.setGuildPreferences(member.guild, member.guild.preferences!);
      } else {
        if (!(member.voice.channel instanceof VoiceChannel)) {
          await answer(languages[member.guild.preferences!.language].cmdPlayErrorNoVoiceChannel);
          return false;
        }
        const tracks = member.guild.preferences!.playlists[data.options[0]].map(t => new Track(t));
        if (!member.guild.player || member.guild.player.voiceChannel.id !== member.voice.channel.id) {
          new Player(member.guild, member.voice.channel, textChannel);
          await member.guild.player!.init();
        }
        member.guild.player!.queue = tracks;
        member.guild.player!.queueIndex = -1;
        member.guild.player!.processQueue();
      }
    } else {
      await answer(languages[member.guild.preferences!.language].cmdPlaylistErrorNotFound);
      return false;
    }
    return true;
  },
};
export default cmd;
