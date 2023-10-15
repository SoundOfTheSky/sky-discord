import {
  AudioPlayer,
  AudioPlayerError,
  AudioPlayerState,
  AudioPlayerStatus,
  AudioResource,
  createAudioPlayer,
  entersState,
  joinVoiceChannel,
  VoiceConnection,
  VoiceConnectionDisconnectReason,
  VoiceConnectionStatus,
} from '@discordjs/voice';
import { Guild, Message, ReactionCollector, TextBasedChannel, VoiceChannel } from 'discord.js';
import type { Track } from './services/track.js';
import languages from './assets/languages/index.js';
import { log, noop, wait } from './services/utils/index.js';
import { GuildPreferences } from './services/guilds.js';

export const guildPlayers = new Map<string, Player>();

const AudioPlayerStatuses = {
  autopaused: 'playerStatusAutopaused',
  paused: 'playerStatusPaused',
  playing: 'playerStatusPlaying',
  idle: 'playerStatusIdle',
  buffering: 'playerStatusBuffering',
};
export default class Player {
  /**Guild in which player is playing sick beats, yo */
  public guild;
  /**Voice channel in which player is playing sick beats, yo-yo */
  public voiceChannel;
  /**Language player speaks */
  public preferences;
  /**Text channel in which player is showing sick widget. Yo? */
  public textChannel;
  /**Player's widget */
  public widget?: Message;
  /**Wow, such a voice connection */
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
  /**Discord.js reaction collector for widget's buttons. */
  private collector?: ReactionCollector;
  /**Here lies interval for auto-updating widget. */
  private widgetUpdateInterval?: NodeJS.Timer;
  /**How many errors happened.
   *
   * Resets to 0 if there was no errors for a last minute.
   */
  private consequentErrors = 0;
  /**Timer to reset errors to 0 after a minute */
  private dropConsequentErrorsTimer = setTimeout(() => (this.consequentErrors = 0), 60000);

  public constructor(
    guild: Guild,
    preferences: GuildPreferences,
    voiceChannel: VoiceChannel,
    textChannel?: TextBasedChannel,
  ) {
    if (guildPlayers.has(guild.id)) throw new Error('This guild already has player');
    this.guild = guild;
    this.voiceChannel = voiceChannel;
    this.preferences = preferences;
    this.textChannel = textChannel;

    guildPlayers.set(guild.id, this);
  }
  /**
   * Happens if player/audio fails.
   * Restarts song if played less than 5s. Have 3 retries.
   * Otherwise go for next song.
   */
  private errorHandler(e: AudioPlayerError | Error) {
    this.queueLock = true;
    log((e as AudioPlayerError).resource ? 'Audio player error' : 'Stream error', e);
    clearTimeout(this.dropConsequentErrorsTimer);
    this.dropConsequentErrorsTimer = setTimeout(() => (this.consequentErrors = 0), 60000);
    this.consequentErrors++;
    if (this.consequentErrors <= 3 && (!this.audioResource || this.audioResource.playbackDuration < 5000)) {
      this.queueLock = false;
      void this.playCurrentTrack();
    } else {
      this.queueLock = false;
      void this.processQueue();
    }
  }
  /**
   * Connect to voice, create widget, create player,
   * register error handling, init queue system.
   */
  public async init() {
    await this.initializeStableVoiceConnection();
    this.audioPlayer.on('stateChange', this.playerStateChangeHandler.bind(this));
    this.audioPlayer.on('error', this.errorHandler.bind(this));
    this.voiceConnection!.subscribe(this.audioPlayer);
    await this.initButtons();
    return this;
  }
  /**Init reactions as buttons */
  private async initButtons() {
    if (!this.textChannel) return;
    this.widget = await this.textChannel.send(languages[this.preferences.language].playerCreatingWidget);
    const buttons = {
      '❌': this.destroy.bind(this, undefined),
      '⏮': this.previous.bind(this),
      '⏯': this.togglePause.bind(this),
      '⏭': this.next.bind(this),
      '🔀': this.shuffle.bind(this),
      '🔁': () => {
        this.loop = (this.loop + 1) % 3;
        void this.updateWidget({});
      },
      '✂': this.removeCurrentSong.bind(this),
    };
    this.collector = this.widget.createReactionCollector({
      dispose: true,
      filter: (reaction, user) =>
        !user.bot && reaction.emoji.name! in buttons && this.voiceChannel.members.some((m) => m.user.id === user.id),
    });
    this.collector.on('collect', (reaction, user) => {
      void this.widget!.reactions.cache.find((wr) => wr.emoji.name === reaction.emoji.name)!
        .users.remove(user.id)
        .catch(noop);
      void buttons[reaction.emoji.name as keyof typeof buttons]();
    });
    for (const btn of Object.keys(buttons)) await this.widget.react(btn);
  }
  /**
   * Create voice connection and make it as stable as it can.
   */
  private async initializeStableVoiceConnection() {
    try {
      this.voiceConnection = joinVoiceChannel({
        guildId: this.guild.id,
        channelId: this.voiceChannel.id,
        adapterCreator: this.guild.voiceAdapterCreator,
      });
      this.voiceConnection.on('stateChange', () => void this.voiceConnectionStateChangeHandler());
      await entersState(this.voiceConnection, VoiceConnectionStatus.Ready, 20000);
    } catch (e) {
      await this.destroy(languages[this.preferences.language].playerVoiceConnectionError3);
    }
  }
  /**Observe voice connection state change and motsly just try to revive it */
  private async voiceConnectionStateChangeHandler() {
    if (!this.voiceConnection) return;
    if (this.voiceConnection.state.status === VoiceConnectionStatus.Disconnected) {
      if (
        this.voiceConnection.state.reason === VoiceConnectionDisconnectReason.WebSocketClose &&
        this.voiceConnection.state.closeCode === 4014
      ) {
        try {
          await entersState(this.voiceConnection, VoiceConnectionStatus.Connecting, 5000);
        } catch {
          await this.destroy(languages[this.preferences.language].playerVoiceConnectionError1);
        }
      } else if (this.voiceConnection.rejoinAttempts < 5) {
        await wait(5000);
        this.voiceConnection.rejoin();
      } else await this.destroy(languages[this.preferences.language].playerVoiceConnectionError2);
    }
  }
  /**Observe player state changes */
  private playerStateChangeHandler(oldState: AudioPlayerState) {
    const newState = this.audioPlayer.state;
    clearInterval(this.widgetUpdateInterval);
    void this.updateWidget({});
    if (newState.status === AudioPlayerStatus.Playing)
      this.widgetUpdateInterval = setInterval(() => void this.updateWidget({}), 5000);
    if (newState.status === AudioPlayerStatus.Idle && oldState.status !== AudioPlayerStatus.Idle)
      void this.processQueue();
  }
  /**
   * Player will fucking explode the moment this method called.
   */
  public async destroy(reason?: string) {
    guildPlayers.delete(this.guild.id);
    clearInterval(this.widgetUpdateInterval);
    this.audioPlayer.stop(true);
    this.queueLock = true;
    this.queue = [];
    if (this.voiceConnection && this.voiceConnection.state.status !== VoiceConnectionStatus.Destroyed)
      this.voiceConnection.destroy();
    if (this.collector) this.collector.stop();
    if (this.widget) {
      if (reason) {
        await this.widget
          .edit(languages[this.preferences.language].playerDestroyReason.replace('{reason}', reason))
          .catch(noop);
        await wait(10000);
      }
      this.widget.delete().catch(noop);
    }
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
    void this.updateWidget({});
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
    if (!this.voiceConnection || this.voiceConnection.state.status === VoiceConnectionStatus.Destroyed || !this.widget)
      return;
    const track = this.queue[this.queueIndex];
    const playbackDuration = Math.floor((this.audioResource?.playbackDuration ?? 0) / 1000);
    const progress = track.duration > 0 && !loading ? (playbackDuration / track.duration) * 35 : 0;
    const lang = languages[this.preferences.language];
    await this.widget
      .edit({
        content: null,
        embeds: [
          {
            title: track.title,
            color: 39423,
            description: track.url,
            author: {
              name: lang.playerTitle,
            },
            fields: [
              {
                name: lang.playerStatusTitle,
                value: loading
                  ? lang.playerStatusLoading
                  : lang[AudioPlayerStatuses[this.audioPlayer.state.status] as keyof typeof languages.english],
                inline: true,
              },
              {
                name: lang.playerTrackTitle,
                value: this.queueIndex + 1 + '/' + this.queue.length,
                inline: true,
              },
              {
                name: lang.playerLoopTitle,
                value: [lang.playerLoopMode1, lang.playerLoopMode2, lang.playerLoopMode3][this.loop],
                inline: true,
              },
              track.duration > 0 && progress >= 0 && progress <= 35
                ? {
                    name: this.durationToString(playbackDuration) + '/' + this.durationToString(track.duration),
                    value: '[' + '▇'.repeat(progress) + '—'.repeat(35 - progress) + ']',
                  }
                : {
                    name: this.durationToString(playbackDuration),
                    value: lang.playerStreamTitle,
                  },
            ],
            footer: {
              text: lang.playerFooter,
            },
          },
        ],
      })
      .catch(noop);
  }
  /**
   * Create audio resource from current track, put error handler on it, and play it like a boss.
   */
  public async playCurrentTrack(begin?: number) {
    try {
      void this.updateWidget({ loading: true });
      this.audioResource = await this.queue[this.queueIndex].createAudioResource(
        this.preferences.youtubeCookies,
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
    this.queueLock = false;
  }
  /**
   * Removes current song from playlist. Plays next song. If it was last song, destroy player.
   */
  public async removeCurrentSong() {
    this.queueLock = true;
    this.audioPlayer.stop();
    if (this.queue.length < 2) await this.destroy();
    else {
      this.queue.splice(this.queueIndex, 1);
      await this.playCurrentTrack();
    }
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
      if (this.loop === 0) return this.destroy();
      if (this.loop === 1) this.queueIndex = 0;
    }
    await this.playCurrentTrack();
    this.queueLock = false;
  }
}
