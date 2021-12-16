import {
  AudioPlayer,
  AudioPlayerError,
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
  /**Guild in which player is playing sick beats, yo */
  public guild;
  /**Voice channel in which player is playing sick beats, yo-yo */
  public voiceChannel;
  /**Text channel in which player is showing sick widget. Yo? */
  public textChannel;
  /**Player's widget */
  public widget?: Message;
  /**Wow, suck a voice connection */
  public voiceConnection?: VoiceConnection;
  /**Discord.js audio player */
  public audioPlayer: AudioPlayer = createAudioPlayer();
  /**Queue of tracks */
  public queue: Track[] = [];
  /**Index of current track in queue */
  public queueIndex = -1;
  /**Discord.js audio resource */
  public audioResource?: AudioResource;
  /**(Za)Looping mode:
   *
   * 0 - No lOOps
   *
   * 1 - lOOps for playling
   *
   * 2 - lOOps for current track
   */
  private loop = 0;
  /**If true will prevent auto-playing next song on player stop. */
  private queueLock = false;
  /**False until voice connection is stable. */
  private readyLock = false;
  /**Discord.js reaction collector for widget's buttons. */
  private collector?: ReactionCollector;
  /**Here lies inteval for auto-updating widget. */
  private widgetUpdateInterval?: NodeJS.Timer;
  /**How many errors happened.
   *
   * Resets to 0 if there was no errors for a last minute.
   */
  private consequentErrors = 0;
  /**Timer to reset errors to 0 after a minute */
  private dropConsequentErrorsTimer?: NodeJS.Timer;
  /**If someone is saving playlist is true. Will block save playlist button. */
  private savingPlaylist = false;
  public constructor(guild: Guild, voiceChannel: VoiceChannel, textChannel?: TextChannel) {
    this.guild = guild;
    this.voiceChannel = voiceChannel;
    this.textChannel = textChannel;
    this.guild.player = this;
  }
  /**
   * Happens if player/audio fails.
   * Restarts song if played less than 5s. Have 3 retries.
   * Otherwise go for next song.
   */
  private errorHandler(e: AudioPlayerError | Error) {
    this.queueLock = true;
    console.log((e as AudioPlayerError).resource ? 'Audio player error' : 'Stream error', e);
    clearTimeout(this.dropConsequentErrorsTimer!);
    this.consequentErrors++;
    if (this.consequentErrors <= 3 && (!this.audioResource || this.audioResource.playbackDuration < 5000)) {
      this.queueLock = false;
      this.playCurrentTrack();
    } else {
      this.queueLock = false;
      this.processQueue();
    }
  }
  /**
   * Connect to voice, create widget, create player,
   * register error handling, init queue system.
   */
  public async init() {
    await this.initializeStableVoiceConnection();
    this.audioPlayer.on('stateChange', (oldState, newState) => {
      clearInterval(this.widgetUpdateInterval!);
      this.updateWidget({});
      if (newState.status === AudioPlayerStatus.Playing) {
        this.widgetUpdateInterval = setInterval(() => this.updateWidget({}), 5000);
        this.dropConsequentErrorsTimer = setTimeout(() => (this.consequentErrors = 0), 60000);
      }
      if (newState.status === AudioPlayerStatus.Idle && oldState.status !== AudioPlayerStatus.Idle) this.processQueue();
    });
    this.audioPlayer.on('error', this.errorHandler.bind(this));
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
  /**
   * Create voice connection and make it as stable as it can.
   */
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
  /**
   * Player will fucking explode the moment this method called.
   */
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
  /**
   * yes it does toggle pause
   */
  public togglePause() {
    if (this.audioPlayer.state.status === AudioPlayerStatus.Paused) this.audioPlayer.unpause();
    else if (this.audioPlayer.state.status === AudioPlayerStatus.Playing) this.audioPlayer.pause();
    // DONT NEED TO DIRECTLY CALL WIDGET UPDATE.
    // Player event will do it for us.
  }
  /**
   * Shuffle playlist with no turning back.
   * Current track is now first track.
   */
  public shuffle() {
    [this.queue[0], this.queue[this.queueIndex]] = [this.queue[this.queueIndex], this.queue[0]];
    for (let i = 1; i < this.queue.length; i++) {
      const i2 = Math.floor(Math.random() * (this.queue.length - 1)) + 1;
      [this.queue[i], this.queue[i2]] = [this.queue[i2], this.queue[i]];
    }
    this.queueIndex = 0;
    this.updateWidget({});
  }
  /**
   * Example: 160 -> "2:40"
   */
  public durationToString(duration: number) {
    const sec = duration % 60;
    return Math.floor(duration / 60) + ':' + (sec < 10 ? '0' + sec : sec);
  }
  /**
   * Update widget. Calculates everything needed for it each time (performance danger).
   */
  public async updateWidget({ loading }: { loading?: boolean }) {
    if (!this.voiceConnection || this.voiceConnection.state.status === VoiceConnectionStatus.Destroyed) return;
    const track = this.queue[this.queueIndex];
    const playbackDuration = Math.floor((this.audioResource?.playbackDuration ?? 0) / 1000);
    const progress =
      track.duration > 0 && !loading && playbackDuration >= track.duration
        ? (playbackDuration / track.duration) * 35
        : 0;
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
              {
                name: 'Использовано памяти',
                value: Math.floor(process.memoryUsage().rss / 1048576) + 'mb',
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
  /**
   * Create audio resource from current track, put error handler on it, and play it like a boss.
   */
  public async playCurrentTrack(begin?: number) {
    try {
      this.updateWidget({ loading: true });
      this.audioResource = await this.queue[this.queueIndex].createAudioResource(
        this.guild.preferences?.youtubeCookies,
        begin,
      );
      this.audioResource.playStream.on('error', this.errorHandler.bind(this));
      this.audioPlayer.play(this.audioResource);
    } catch (error) {
      this.errorHandler(error as Error);
    }
  }
  /**
   * Next track! Will do nothing if end of playlist. Or will loop if it's enabled.
   */
  public async next(): Promise<void> {
    this.queueLock = true;
    this.audioPlayer.stop();
    if (this.queueIndex === this.queue.length - 1) {
      if (this.loop === 1) this.queueIndex = 0;
    } else this.queueIndex++;
    await this.playCurrentTrack();
    this.updateWidget({});
    this.queueLock = false;
  }
  /**
   * Previous track! Will do nothing if start of playlist. Or will loop if it's enabled.
   */
  public async previous(): Promise<void> {
    this.queueLock = true;
    this.audioPlayer.stop();
    if (this.queueIndex === 0) {
      if (this.loop === 1) this.queueIndex = this.queue.length - 1;
    } else this.queueIndex--;
    await this.playCurrentTrack();
    this.updateWidget({});
    this.queueLock = false;
  }
  /**
   * Removes current song from playlist. Plays next song. If it was last song, destroy player.
   */
  public async removeCurrentSong() {
    this.queueLock = true;
    this.audioPlayer.stop();
    if (this.queue.length < 2) this.destroy('Была удалена последняя песня из плейлиста.');
    else {
      this.queue.splice(this.queueIndex, 1);
      await this.playCurrentTrack();
    }
    this.updateWidget({});
    this.queueLock = false;
  }
  /**
   * Queue. Same as next() but will respect loop, have some queue safety checks, and destroy if last song ended.
   */
  public async processQueue(): Promise<void> {
    if (this.queueLock || this.audioPlayer.state.status !== AudioPlayerStatus.Idle || this.queue.length === 0) return;
    this.queueLock = true;
    if (this.loop !== 2) this.queueIndex++;
    if (this.queueIndex === this.queue.length) {
      if (this.loop === 0) return this.destroy('Последняя песня закончилась.');
      if (this.loop === 1) this.queueIndex = 0;
    }
    await this.playCurrentTrack();
    this.queueLock = false;
  }
  /**
   * Ask user player, what name to give to current playlist and save it. Saving may take a lot of time.
   *
   * ASYNC CLUSTERFUCK
   */
  public async savePlaylistDialog(user: User) {
    try {
      if (this.savingPlaylist) return;
      this.savingPlaylist = true;
      const msg = await this.textChannel!.send(
        user.toString() + ' Чтобы сохранить текущий плейлист, напиши его название.\n(У тебя 30 секунд)',
      );
      const end = () => {
        msg.delete().catch(() => {});
        this.savingPlaylist = false;
      };
      msg
        .awaitReactions({
          filter: (r, u) => r.emoji.name === '❌' && u.id === user.id,
          time: 30000,
          max: 1,
        })
        .then(end)
        .catch(end);
      this.textChannel!.awaitMessages({ max: 1, time: 30000, filter: msg => msg.member?.user.id === user.id }).then(
        async messages => {
          const playlistMsg = messages.at(0);
          if (msg.deleted) {
            this.savingPlaylist = false;
            return;
          }
          msg.delete().catch(() => {});
          if (!playlistMsg) {
            this.savingPlaylist = false;
            return;
          }
          if (
            playlistMsg.content.length > 0 &&
            playlistMsg.content.length <= 64 &&
            !playlistMsg.content.includes(' ')
          ) {
            try {
              this.guild.preferences!.playlists[playlistMsg.content] = [...this.queue];
              await client.setGuildPreferences(this.guild, this.guild.preferences!);
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
          this.savingPlaylist = false;
          setTimeout(() => {
            playlistMsg.delete().catch(() => {});
          }, 5000);
        },
      );
      await msg.react('❌');
    } catch {}
  }
}
