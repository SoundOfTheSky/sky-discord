import {
  AudioPlayer,
  AudioPlayerStatus,
  AudioResource,
  createAudioPlayer,
  entersState,
  joinVoiceChannel,
  VoiceConnection,
  VoiceConnectionDisconnectReason,
  VoiceConnectionStatus,
} from '@discordjs/voice';
import { Guild, Message, ReactionCollector, TextChannel, User, VoiceChannel } from 'discord.js';
import type { Track } from './track';
const AudioPlayerStatuses = {
  autopaused: 'Остановлен',
  paused: 'На паузе',
  playing: 'Проигрываем',
  idle: 'Ожидаем',
  buffering: 'Загружаем',
};
export default class Player {
  public guild;
  public voiceChannel;
  public textChannel;
  public widget?: Message;
  public voiceConnection?: VoiceConnection;
  public audioPlayer: AudioPlayer = createAudioPlayer();
  public queue: Track[] = [];
  public queueIndex = -1;
  public audioResource?: AudioResource;
  private loop = 0;
  private queueLock = false;
  private readyLock = false;
  private collector?: ReactionCollector;
  private widgetUpdateInterval?: NodeJS.Timer;

  public constructor(guild: Guild, voiceChannel: VoiceChannel, textChannel?: TextChannel) {
    this.guild = guild;
    this.voiceChannel = voiceChannel;
    this.textChannel = textChannel;
    this.guild.player = this;
  }
  public async init() {
    await this.initializeStableVoiceConnection();
    this.audioPlayer.on('stateChange', (oldState, newState) => {
      clearInterval(this.widgetUpdateInterval!);
      this.updateWidget({});
      if (newState.status === AudioPlayerStatus.Playing)
        this.widgetUpdateInterval = setInterval(() => this.updateWidget({}), 2500);
      if (newState.status === AudioPlayerStatus.Idle && oldState.status !== AudioPlayerStatus.Idle) this.processQueue();
    });
    this.audioPlayer.on('error', e => {
      console.log('audio player error', e);
      this.next(true);
    });
    this.voiceConnection!.subscribe(this.audioPlayer);

    (async () => {
      if (this.textChannel) {
        try {
          this.widget = await this.textChannel.send('Создаем ахуенный плеер');
          const buttons = {
            '❌': () => {
              this.destroy();
            },
            '⏮': () => {
              this.previous();
            },
            '⏯': () => {
              this.togglePause();
            },
            '⏭': () => {
              this.next();
            },
            '🔀': () => {
              this.shuffle();
            },
            '🔁': () => {
              this.loop = (this.loop + 1) % 3;
              if (this.audioPlayer.state.status !== AudioPlayerStatus.Playing) this.updateWidget({});
            },
            '✂': () => {
              this.removeCurrentSong();
            },
            '💾': (user: User) => {
              this.savePlaylistDialog(user);
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
            buttons[r.emoji.name as keyof typeof buttons](u);
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
    clearInterval(this.widgetUpdateInterval!);
    this.audioPlayer!.stop(true);
    this.queueLock = true;
    this.queue = [];
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
    if (this.audioPlayer.state.status === AudioPlayerStatus.Paused) this.audioPlayer.unpause();
    else if (this.audioPlayer.state.status === AudioPlayerStatus.Playing) this.audioPlayer.pause();
  }
  public shuffle() {
    [this.queue[0], this.queue[this.queueIndex]] = [this.queue[this.queueIndex], this.queue[0]];
    for (let i = 1; i < this.queue.length; i++) {
      const i2 = Math.floor(Math.random() * (this.queue.length - 1)) + 1;
      [this.queue[i], this.queue[i2]] = [this.queue[i2], this.queue[i]];
    }
    this.queueIndex = 0;
    if (this.audioPlayer.state.status !== AudioPlayerStatus.Playing) this.updateWidget({});
  }
  public durationToString(duration: number) {
    const sec = duration % 60;
    return Math.floor(duration / 60) + ':' + (sec < 10 ? '0' + sec : sec);
  }
  public async updateWidget({ loading }: { loading?: boolean }) {
    const track = this.queue[this.queueIndex];
    const playbackDuration = Math.floor((this.audioResource?.playbackDuration ?? 0) / 1000);
    const progress = track.duration > 0 ? (playbackDuration / track.duration) * 35 : 0;
    this.widget
      ?.edit({
        content: null,
        embeds: [
          {
            title: track.title,
            color: 39423,
            description: track.url,
            author: {
              name: '🎵 Randobot Player 🎵',
            },
            fields: [
              {
                name: 'Статус',
                value: loading ? 'Загрузка' : AudioPlayerStatuses[this.audioPlayer.state.status],
                inline: true,
              },
              {
                name: 'Трек',
                value: this.queueIndex + 1 + '/' + this.queue.length,
                inline: true,
              },
              {
                name: 'Повтор',
                value: ['-', '🔁 Повторяем плейлист', '🔂 Повторяем данную песню'][this.loop],
                inline: true,
              },
              track.duration > 0
                ? {
                    name: this.durationToString(playbackDuration) + '/' + this.durationToString(track.duration),
                    value: '[' + '▇'.repeat(progress) + '—'.repeat(35 - progress) + ']',
                  }
                : {
                    name: this.durationToString(playbackDuration),
                    value: '[Стрим]',
                  },
            ],
            footer: {
              text: '❌ - Выключить | ⏮ - Пред. | ⏯ - Пауза | ⏭ - След. | 🔀 - Перемешать | 🔁 - Повтор | ✂ - Вырезать трек | 💾 - Сохранить плейлист',
            },
          },
        ],
      })
      .catch(() => {});
  }
  public playCurrentTrack(): Promise<boolean> {
    return new Promise(async r => {
      try {
        await this.updateWidget({ loading: true });
        this.audioResource = await this.queue[this.queueIndex].createAudioResource();
        this.audioPlayer.play(this.audioResource);
        r(true);
      } catch (error) {
        r(false);
      }
    });
  }
  public async next(destroyOnEnd = false): Promise<void> {
    this.queueLock = true;
    this.audioPlayer.stop();
    if (this.queueIndex === this.queue.length - 1) {
      if (this.loop === 1) this.queueIndex = 0;
      else if (destroyOnEnd) {
        this.destroy('Предыдущая песня сдохла, была пропущена и плейлист закончился.');
        return;
      }
    } else this.queueIndex++;
    if (!(await this.playCurrentTrack())) await this.next(true);
    this.queueLock = false;
  }
  public async previous(destroyOnEnd = false): Promise<void> {
    this.queueLock = true;
    this.audioPlayer.stop();
    if (this.queueIndex === 0) {
      if (this.loop === 1) this.queueIndex = this.queue.length - 1;
      else if (destroyOnEnd) {
        this.destroy('Предыдущая песня сдохла, была пропущена и плейлист закончился.');
        return;
      }
    } else this.queueIndex--;
    if (!(await this.playCurrentTrack())) await this.previous(true);
    this.queueLock = false;
  }
  public async removeCurrentSong() {
    this.queueLock = true;
    this.audioPlayer.stop();
    if (this.queue.length < 2) this.destroy('Была удалена последняя песня из плейлиста.');
    else {
      this.queue.splice(this.queueIndex, 1);
      if (!(await this.playCurrentTrack())) await this.next(true);
    }
    this.queueLock = false;
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
  public async savePlaylistDialog(user: User) {
    try {
      const msg = await this.textChannel!.send(
        user.toString() + ' Чтобы сохранить текущий плейлист, напиши его название.\n(У тебя 30 секунд)',
      );
      msg
        .awaitReactions({
          filter: (r, u) => r.emoji.name === '❌' && u.id === user.id,
          time: 30000,
          max: 1,
        })
        .then(() => {
          msg.delete().catch(() => {});
        })
        .catch(() => {
          msg.delete().catch(() => {});
        });
      this.textChannel!.awaitMessages({ max: 1, time: 30000, filter: msg => msg.member?.user.id === user.id }).then(
        async messages => {
          const playlistMsg = messages.at(0);
          if (msg.deleted) return;
          msg.delete().catch(() => {});
          if (!playlistMsg) return;
          if (
            playlistMsg.content.length > 0 &&
            playlistMsg.content.length <= 64 &&
            !playlistMsg.content.includes(' ')
          ) {
            try {
              this.guild.preferences.playlists[playlistMsg.content] = [...this.queue];
              await client.setGuildPreferences(this.guild, this.guild.preferences);
              playlistMsg.react('👌').catch(() => {});
            } catch {
              const m = await playlistMsg.reply('Не удалось сохранить плейлист.').catch(() => {});
              setTimeout(() => m && m.delete().catch(() => {}), 5000);
            }
          } else {
            const m = await playlistMsg
              .reply('Плейлист не должен содержать пробелов и быть не больше 64 символов.')
              .catch(() => {});
            setTimeout(() => m && m.delete().catch(() => {}), 5000);
          }
          setTimeout(() => {
            playlistMsg.delete().catch(() => {});
          }, 5000);
        },
      );
      await msg.react('❌');
    } catch {}
  }
}
