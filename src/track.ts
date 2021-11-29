import ytpl from 'ytpl';
import ytsr from 'ytsr';
import { AudioResource, createAudioResource, demuxProbe } from '@discordjs/voice';
import ytdl from 'ytdl-core';
export interface TrackData {
  url: string;
  title: string;
  duration: number;
  cookie?: string;
}
const qs = {
  AUDIO_QUALITY_MEDIUM: 0,
  AUDIO_QUALITY_LOW: 1,
  undefined: 2,
};
const vqs = {
  undefined: 0,
  '144p': 1,
  '144p 15fps': 2,
  '144p60 HDR': 3,
  '240p': 4,
  '240p60 HDR': 5,
  '270p': 6,
  '360p': 7,
  '360p60 HDR': 8,
  '480p': 9,
  '480p60 HDR': 10,
  '720p': 11,
  '720p60': 12,
  '720p60 HDR': 13,
  '1080p': 14,
  '1080p60': 15,
  '1080p60 HDR': 16,
  '1440p': 17,
  '1440p60': 18,
  '1440p60 HDR': 19,
  '2160p': 20,
  '2160p60': 21,
  '2160p60 HDR': 22,
  '4320p': 23,
  '4320p60': 24,
};
export class Track implements TrackData {
  public readonly url: string;
  public readonly title: string;
  public readonly duration: number;
  public readonly cookie: string;
  public constructor({ url, title, duration, cookie }: TrackData) {
    this.url = url;
    this.title = title;
    this.duration = duration;
    this.cookie = cookie ?? '';
  }
  public async createAudioResource(): Promise<AudioResource<Track>> {
    const info = await ytdl.getInfo(this.url, {
      requestOptions: {
        headers: {
          cookie: this.cookie,
        },
      },
    });
    let formats = info.formats.filter(f => f.hasAudio && (!info.videoDetails.isLiveContent || f.isHLS));
    const highestAudioQuality = formats.sort(
      (a, b) => qs[a.audioQuality as keyof typeof qs] - qs[b.audioQuality as keyof typeof qs],
    )[0].audioQuality;
    formats = formats
      .filter(f => f.audioQuality === highestAudioQuality)
      .sort((a, b) => (b.hasVideo ? vqs[a.qualityLabel] - vqs[b.qualityLabel] : 1));
    if (formats.length === 0) throw new Error('No audio source');
    const stream = ytdl.downloadFromInfo(info, {
      format: formats[0],
      highWaterMark: 1 << 25,
    });
    const probe = await demuxProbe(stream);
    return createAudioResource(probe.stream, { metadata: this, inputType: probe.type });
  }
  public static async from(url: string, cookie = ''): Promise<Track[]> {
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
          limit: Infinity,
        });
        for (const item of playlist.items)
          tracks.push(
            new Track({
              title: item.title,
              url: item.shortUrl,
              duration: item.durationSec ?? 0,
              cookie,
            }),
          );
      } else {
        const info = await ytdl.getBasicInfo(url, {
          requestOptions: {
            headers: {
              cookie,
            },
          },
        });
        tracks.push(
          new Track({
            title: info.videoDetails.title,
            duration: +info.videoDetails.lengthSeconds,
            url,
            cookie,
          }),
        );
      }
    } else {
      const results = await ytsr(url, {
        limit: 3,
        requestOptions: {
          headers: {
            cookie,
          },
        },
      });
      const result = results.items.find(i => i.type === 'channel' || i.type === 'playlist' || i.type === 'video');
      if (result) tracks.push(...(await this.from((result as ytsr.Video).url)));
    }
    return tracks;
  }
}
