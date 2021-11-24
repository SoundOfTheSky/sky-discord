import { getInfo } from 'ytdl-core';
import ytpl from 'ytpl';
import { AudioResource, createAudioResource, demuxProbe } from '@discordjs/voice';
import { exec as ytdl } from 'youtube-dl-exec';
export interface TrackData {
  url: string;
  title: string;
}
export class Track implements TrackData {
  public readonly url: string;
  public readonly title: string;
  private constructor({ url, title }: TrackData) {
    this.url = url;
    this.title = title;
  }
  public createAudioResource(): Promise<AudioResource<Track>> {
    return new Promise((resolve, reject) => {
      const process = ytdl(
        this.url,
        {
          quiet: true,
          format: 'bestaudio[ext=webm+acodec=opus+asr=48000]/bestaudio',
          limitRate: '100K',
          output: '-',
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
            .then(probe => resolve(createAudioResource(probe.stream, { metadata: this, inputType: probe.type })))
            .catch(onError);
        })
        .catch(onError);
    });
  }
  public static async from(url: string): Promise<Track[]> {
    const ezURL = url.replace('www.', '').replace('http://', '').replace('https://', '');
    const tracks: Track[] = [];
    if (ezURL.startsWith('youtube.com/')) {
      if (ezURL.startsWith('youtube.com/playlist') || ezURL.startsWith('youtube.com/channel')) {
        const playlist = await ytpl(url, {
          limit: Infinity,
        });
        for (const item of playlist.items)
          tracks.push(
            new Track({
              title: item.title,
              url: item.shortUrl,
            }),
          );
      } else {
        const info = await getInfo(url);
        tracks.push(
          new Track({
            title: info.videoDetails.title,
            url,
          }),
        );
      }
    }
    return tracks;
  }
}
