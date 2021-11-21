/*import { Command } from '../interfaces';
import ytdl from 'ytdl-core';
import { GuildMember } from 'discord.js';
import { getVoiceConnection, joinVoiceChannel,AudioResource, } from '@discordjs/voice';
function createAudioResource(): Promise<AudioResource<Track>> {
  return new Promise((resolve, reject) => {
    const process = ytdl(
      this.url,
      {
        o: '-',
        q: '',
        f: 'bestaudio[ext=webm+acodec=opus+asr=48000]/bestaudio',
        r: '100K',
      },
      { stdio: ['ignore', 'pipe', 'ignore'] },
    );
    if (!process.stdout) {
      reject(new Error('No stdout'));
      return;
    }
    const stream = process.stdout;
    const onError = (error: Error) => {
      if (!process.killed) process.kill();
      stream.resume();
      reject(error);
    };
    process
      .once('spawn', () => {
        demuxProbe(stream)
          .then((probe: { stream: any; type: any; }) => resolve(createAudioResource(probe.stream, { metadata: this, inputType: probe.type })))
          .catch(onError);
      })
      .catch(onError);
  });
const cmd: Command = {
  name: 'play',
  description: 'Запустить музяку',
  options: [
    {
      name: 'url',
      description: 'Ссылка',
      type: 'STRING',
      required: true,
    },
  ],
  async handler(data) {
    console.log(data.options[0]);
    const guild = data.interaction ? data.interaction.guild! : data.msg!.guild!;
    const member = data.interaction ? (data.interaction.member as GuildMember) : data.msg!.member!;
    if (!member.voice.channel) return 'Ало! Куда присоединяться? Сначала сам зайди в канал.';
    const vc = await joinVoiceChannel({
      guildId: guild.id,
      channelId: member.voice.channel.id,
      adapterCreator: guild.voiceAdapterCreator,
    });
  },
};
export default cmd;
*/
