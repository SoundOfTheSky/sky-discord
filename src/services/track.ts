import { AudioResource, createAudioResource, demuxProbe } from '@discordjs/voice';
import ytpl from 'ytpl';
import ytsr from 'ytsr';
import ytdl from 'ytdl-core';

/**Track contains all info needed to play a song */
export type TrackData = {
  url: string;
  title: string;
  duration: number;
};
/**Audio quality preference (lower is more preferable) */
const qs = ['AUDIO_QUALITY_MEDIUM', 'AUDIO_QUALITY_LOW', undefined];
/**Video quality preference (lower is more preferable) */
const vqs = [
  undefined,
  '144p',
  '144p 15fps',
  '144p60 HDR',
  '240p',
  '240p60 HDR',
  '270p',
  '360p',
  '360p60 HDR',
  '480p',
  '480p60 HDR',
  '720p',
  '720p60',
  '720p60 HDR',
  '1080p',
  '1080p60',
  '1080p60 HDR',
  '1440p',
  '1440p60',
  '1440p60 HDR',
  '2160p',
  '2160p60',
  '2160p60 HDR',
  '4320p',
  '4320p60',
] as const;
/**Track contains all info needed to play song */
export class Track implements TrackData {
  public readonly url: string;
  public readonly title: string;
  public readonly duration: number;
  public constructor({ url, title, duration }: TrackData) {
    this.url = url;
    this.title = title;
    this.duration = duration;
  }
  /**Create audio resource from this track. Returns stream or throws an error. */
  public async createAudioResource(cookie?: string, begin?: number): Promise<AudioResource<Track>> {
    const requestOptions = {
      headers: {
        ...(cookie && { cookie: cookie }),
      },
    } as const;
    const info = await ytdl.getInfo(this.url, {
      requestOptions,
    });
    let formats = info.formats.filter((f) => f.hasAudio && (!info.videoDetails.isLiveContent || f.isHLS));
    const highestAudioQuality = formats.sort((a, b) => qs.indexOf(a.audioQuality) - qs.indexOf(b.audioQuality))[0]
      .audioQuality;
    formats = formats
      .filter((f) => f.audioQuality === highestAudioQuality)
      .sort((a, b) => (b.hasVideo ? vqs.indexOf(a.qualityLabel) - vqs.indexOf(b.qualityLabel) : 1));
    if (formats.length === 0) throw new Error('No audio source');
    console.log(`Playing`, formats[0].qualityLabel, formats[0].audioQuality);
    const stream = ytdl.downloadFromInfo(info, {
      requestOptions,
      format: formats[0],
      highWaterMark: 1 << 25,
      liveBuffer: 4000,
      ...(begin && { begin }),
    });
    const probe = await demuxProbe(stream);
    return createAudioResource(probe.stream, { metadata: this, inputType: probe.type });
  }
  /**Create array of tracks from youtube url */
  public static async from(url: string, cookie = ''): Promise<Track[]> {
    const requestOptions = {
      headers: {
        ...(cookie && { cookie: cookie }),
      },
    } as const;
    url = url.replace('youtu.be/', 'youtube.com/watch?v=');
    const ezURL = url.replace('www.', '').replace('http://', '').replace('https://', '');
    const tracks: Track[] = [];
    if (ezURL.startsWith('youtube.com/')) {
      if (
        ezURL.startsWith('youtube.com/playlist') ||
        ezURL.startsWith('youtube.com/channel') ||
        ezURL.startsWith('youtube.com/c/')
      ) {
        const playlist = await ytpl(url, {
          requestOptions,
          limit: Infinity,
        });
        for (const item of playlist.items)
          tracks.push(
            new Track({
              title: item.title,
              url: item.shortUrl,
              duration: item.durationSec ?? 0,
            }),
          );
      } else {
        const info = await ytdl.getBasicInfo(url, {
          requestOptions,
        });
        tracks.push(
          new Track({
            title: info.videoDetails.title,
            duration: +info.videoDetails.lengthSeconds,
            url,
          }),
        );
      }
    } else {
      const results = await ytsr(url, {
        limit: 3,
        requestOptions,
      });
      const result = results.items.find((i) => i.type === 'channel' || i.type === 'playlist' || i.type === 'video');
      if (result) tracks.push(...(await this.from((result as ytsr.Video).url)));
    }
    return tracks;
  }
}
