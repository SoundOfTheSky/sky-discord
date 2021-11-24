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
import { Guild, Message, ReactionCollector, TextChannel, VoiceChannel } from 'discord.js';
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
  private queueIndex = -1;
  private loop = 0;
  private queueLock = false;
  private readyLock = false;
  private collector?: ReactionCollector;

  public constructor(guild: Guild, voiceChannel: VoiceChannel, textChannel?: TextChannel) {
    this.guild = guild;
    this.voiceChannel = voiceChannel;
    this.textChannel = textChannel;
    this.guild.player = this;
  }
  public async init() {
    await this.initializeStableVoiceConnection();
    this.audioPlayer.on('stateChange', (oldState, newState) => {
      if (newState.status === AudioPlayerStatus.Idle && oldState.status !== AudioPlayerStatus.Idle) this.processQueue();
    });
    this.audioPlayer.on('error', () => {
      this.next();
    });
    this.voiceConnection!.subscribe(this.audioPlayer);

    (async () => {
      if (this.textChannel) {
        try {
          this.widget = await this.textChannel.send('Создаем ахуенный виджет');
          const buttons = {
            '❌': () => {
              this.destroy();
            },
            '⏪': async () => {
              this.queueLock = true;
              this.audioPlayer.stop();
              await this.previous();
              this.queueLock = false;
            },
            '⏯': () => {
              this.togglePause();
              this.updateWidget({});
            },
            '⏩': async () => {
              this.queueLock = true;
              this.audioPlayer.stop();
              await this.next();
              this.queueLock = false;
            },
            '🔀': () => {
              this.shuffle();
              this.updateWidget({});
            },
            '🔄': () => {
              this.loop = (this.loop + 1) % 3;
              this.updateWidget({});
            },
          };
          this.collector = this.widget.createReactionCollector({
            dispose: true,
            filter: (r, u) =>
              !u.bot && (r.emoji.name ?? '!') in buttons && !!this.voiceChannel.members.find(m => m.user.id === u.id),
          });
          this.collector.on('collect', async (r, u) => {
            this.widget!.reactions.cache.find(wr => wr.emoji.name === r.emoji.name)!
              .users.remove(u.id)
              .catch(() => {});
            buttons[r.emoji.name as keyof typeof buttons]();
          });
          for (const btn of Object.keys(buttons)) await this.widget.react(btn);
        } catch {}
      }
    })();
  }
  private initializeStableVoiceConnection: () => Promise<void> = () =>
    new Promise(async (r, j) => {
      try {
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
                j();
                this.destroy('Соединение наебнулось.');
              }
            } else if (this.voiceConnection!.rejoinAttempts < 5) {
              await new Promise(r => setTimeout(r, (this.voiceConnection!.rejoinAttempts + 1) * 5000));
              this.voiceConnection!.rejoin();
            } else {
              j();
              this.destroy('Содинение наебнулось и не смогло разъебнуться.');
            }
          } else if (
            !this.readyLock &&
            (newState.status === VoiceConnectionStatus.Connecting ||
              newState.status === VoiceConnectionStatus.Signalling)
          ) {
            this.readyLock = true;
            try {
              await entersState(this.voiceConnection!, VoiceConnectionStatus.Ready, 20000);
              r();
            } catch {
              if (this.voiceConnection!.state.status !== VoiceConnectionStatus.Destroyed) {
                j();
                this.destroy('Не получилось установить соединение.');
              }
            } finally {
              this.readyLock = false;
            }
          }
        });
      } catch (e) {
        j(e);
      }
    });
  public async destroy(reason?: string) {
    this.queueLock = true;
    this.queue = [];
    this.audioPlayer!.stop(true);
    if (this.voiceConnection && this.voiceConnection.state.status !== VoiceConnectionStatus.Destroyed)
      this.voiceConnection.destroy();
    if (this.collector) this.collector.stop();
    if (this.widget) {
      if (reason) {
        await this.widget.edit('Плеер отключился по причине:\n' + reason).catch(() => {});
        await new Promise(r => setTimeout(r, 10000));
      }
      this.widget.delete().catch(() => {});
    }
    delete this.guild.player;
  }
  public togglePause() {
    if (this.audioPlayer[this.paused ? 'unpause' : 'pause']()) this.paused = !this.paused;
  }
  public shuffle() {
    [this.queue[0], this.queue[this.queueIndex]] = [this.queue[this.queueIndex], this.queue[0]];
    for (let i = 1; i < this.queue.length; i++) {
      const i2 = Math.floor(Math.random() * (this.queue.length - 1)) + 1;
      [this.queue[i], this.queue[i2]] = [this.queue[i2], this.queue[i]];
    }
    this.queueIndex = 0;
  }
  public async updateWidget({ loading }: { loading?: boolean }) {
    const track = this.queue[this.queueIndex];
    this.widget?.edit(
      `${loading ? 'Загружаем' : this.paused ? '⏸На паузе⏸' : 'Сейчас играет'}[${this.queueIndex + 1}/${
        this.queue.length
      }]: ${track.title}\n${track.url}\n🔄${
        ['Повтор отключен', 'Повторяем плейлист', 'Повторяем данную песню'][this.loop]
      }🔄`,
    );
  }
  public playCurrentTrack(): Promise<boolean> {
    // https://www.youtube.com/watch?v=yHu3T6gjmEY&ab_channel=USAO
    // https://www.youtube.com/watch?v=Xyy7bvMc6eA&ab_channel=USAO
    return new Promise(async r => {
      try {
        await this.updateWidget({ loading: true });
        this.audioPlayer.play(await this.queue[this.queueIndex].createAudioResource());
        await this.updateWidget({});
        r(true);
      } catch (error) {
        r(false);
      }
    });
  }
  public async next(): Promise<void> {
    if (this.queueIndex === this.queue.length - 1) {
      if (this.loop !== 1) this.queueIndex = 0;
      else {
        this.destroy('Последняя песня была переключена.');
        return;
      }
    } else this.queueIndex++;
    if (!(await this.playCurrentTrack())) await this.next();
  }
  public async previous(): Promise<void> {
    if (this.queueIndex === this.queue.length - 1) {
      if (this.loop !== 1) this.queueIndex = this.queue.length - 1;
      else return;
    } else this.queueIndex--;
    if (!(await this.playCurrentTrack())) await this.previous();
  }
  public async processQueue(): Promise<void> {
    if (this.queueLock || this.audioPlayer.state.status !== AudioPlayerStatus.Idle || this.queue.length === 0) return;
    this.queueLock = true;
    if (this.loop !== 2) this.queueIndex++;
    if (this.queueIndex === this.queue.length) {
      if (this.loop === 0) return this.destroy('Последняя песня закончилась.');
      if (this.loop === 1) this.queueIndex = 0;
    }
    if (await this.playCurrentTrack()) this.queueLock = false;
    else {
      this.queueLock = false;
      return this.processQueue();
    }
  }
}
