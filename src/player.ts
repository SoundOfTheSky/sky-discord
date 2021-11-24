import {
  AudioPlayer,
  AudioPlayerStatus,
  createAudioPlayer,
  entersState,
  joinVoiceChannel,
  VoiceConnection,
  VoiceConnectionDisconnectReason,
  VoiceConnectionStatus,
} from '@discordjs/voice';
import { Guild, Message, TextChannel, VoiceChannel } from 'discord.js';
import type { Track } from './track';
export default class Player {
  public guild;
  public voiceChannel;
  public textChannel;
  public widget?: Message;
  public voiceConnection?: VoiceConnection;
  public audioPlayer: AudioPlayer = createAudioPlayer();
  public queue: Track[] = [];
  private paused = false;
  private queueIndex = 0;
  private loop = 0;
  private queueLock = false;
  private readyLock = false;

  public constructor(guild: Guild, voiceChannel: VoiceChannel, textChannel?: TextChannel) {
    this.guild = guild;
    this.voiceChannel = voiceChannel;
    this.textChannel = textChannel;
    this.guild.player = this;
  }
  public async init() {
    this.voiceConnection = await joinVoiceChannel({
      guildId: this.guild.id,
      channelId: this.voiceChannel.id,
      adapterCreator: this.guild.voiceAdapterCreator,
    });
    this.voiceConnection.on('stateChange', async (oldState, newState) => {
      if (newState.status === VoiceConnectionStatus.Disconnected) {
        if (newState.reason === VoiceConnectionDisconnectReason.WebSocketClose && newState.closeCode === 4014) {
          try {
            await entersState(this.voiceConnection!, VoiceConnectionStatus.Connecting, 5000);
          } catch {
            this.destroy();
          }
        } else if (this.voiceConnection!.rejoinAttempts < 5) {
          await new Promise(r => setTimeout(r, (this.voiceConnection!.rejoinAttempts + 1) * 5000));
          this.voiceConnection!.rejoin();
        } else this.destroy();
      } else if (newState.status === VoiceConnectionStatus.Destroyed) this.destroy();
      else if (
        !this.readyLock &&
        (newState.status === VoiceConnectionStatus.Connecting || newState.status === VoiceConnectionStatus.Signalling)
      ) {
        this.readyLock = true;
        try {
          await entersState(this.voiceConnection!, VoiceConnectionStatus.Ready, 20000);
        } catch {
          if (this.voiceConnection!.state.status !== VoiceConnectionStatus.Destroyed) this.destroy();
        } finally {
          this.readyLock = false;
        }
      }
    });
    this.audioPlayer.on('stateChange', (oldState, newState) => {
      if (newState.status === AudioPlayerStatus.Idle && oldState.status !== AudioPlayerStatus.Idle) this.processQueue();
      /*else if (newState.status === AudioPlayerStatus.Playing)
        (newState.resource as AudioResource<Track>).metadata.onStart();*/
    });
    this.audioPlayer.on('error', () => {
      //(error.resource as AudioResource<Track>).metadata.onError(error)
      this.next();
    });
    this.voiceConnection.subscribe(this.audioPlayer);
    if (this.textChannel) {
      try {
        this.widget = await this.textChannel.send('Создаем ахуенный виджет');
        const buttons = {
          '◀': () => {
            this.previous();
          },
          '⏸': () => {
            this.togglePause();
          },
          '▶': () => {
            this.next();
          },
          '🔄': () => {
            this.loop = (this.loop + 1) % 3;
          },
          '⏹': () => {
            this.destroy();
          },
        };
        for (const btn of Object.keys(buttons)) await this.widget.react(btn);
        const collector = this.widget.createReactionCollector({
          dispose: true,
          filter: (r, u) =>
            (r.emoji.name ?? '!') in buttons && !!this.voiceChannel.members.find(m => m.user.id === u.id),
        });
        collector.on('collect', async (r, u) => {
          this.widget!.reactions.cache.find(wr => wr.emoji.name === r.emoji.name)!
            .users.remove(u.id)
            .catch(() => {});
          buttons[r.emoji.name as keyof typeof buttons]();
        });
        await entersState(this.voiceConnection!, VoiceConnectionStatus.Ready, 20000);
      } catch (e) {
        this.destroy();
      }
    }
  }
  public destroy() {
    this.queueLock = true;
    this.queue = [];
    this.audioPlayer!.stop(true);
    if (this.voiceConnection && this.voiceConnection.state.status !== VoiceConnectionStatus.Destroyed)
      this.voiceConnection.destroy();
    if (this.widget) this.widget.delete().catch(() => {});
    delete this.guild.player;
  }
  public togglePause() {
    if (this.audioPlayer[this.paused ? 'unpause' : 'pause']()) this.paused = !this.paused;
  }
  public shuffle() {
    for (let i = 0; i < this.queue.length; i++) {
      const i2 = Math.floor(Math.random() * this.queue.length);
      [this.queue[i], this.queue[i2]] = [this.queue[i2], this.queue[i]];
    }
  }
  public playCurrentTrack(): Promise<boolean> {
    return new Promise(async r => {
      try {
        this.audioPlayer.play(await this.queue[this.queueIndex].createAudioResource());
        r(true);
      } catch (error) {
        r(false);
      }
    });
  }
  public next() {
    if (this.queueIndex === this.queue.length - 1) {
      if (this.loop !== 1) this.queueIndex = 0;
      else return this.destroy();
    } else this.queueIndex++;
    this.playCurrentTrack();
  }
  public previous() {
    if (this.queueIndex === this.queue.length - 1) {
      if (this.loop !== 1) this.queueIndex = this.queue.length - 1;
      else return this.destroy();
    } else this.queueIndex--;
    this.playCurrentTrack();
  }
  public async processQueue(): Promise<void> {
    if (this.queueLock || this.audioPlayer.state.status !== AudioPlayerStatus.Idle || this.queue.length === 0) return;
    this.queueLock = true;
    if (this.loop !== 2) this.queueIndex++;
    if (this.queueIndex === this.queue.length) {
      if (this.loop === 0) return this.destroy();
      if (this.loop === 1) this.queueIndex = 0;
    }
    if (await this.playCurrentTrack()) this.queueLock = false;
    else {
      this.queueLock = false;
      return this.processQueue();
    }
  }
}
