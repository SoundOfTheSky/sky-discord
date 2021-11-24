import { getInfo } from 'ytdl-core';
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
  public static async fromYouTube(url: string): Promise<Track> {
    const info = await getInfo(url);
    return new Track({
      title: info.videoDetails.title,
      url,
    });
  }
}
