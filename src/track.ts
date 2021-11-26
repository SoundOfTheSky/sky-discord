import ytpl from 'ytpl';
import { AudioResource, createAudioResource, demuxProbe } from '@discordjs/voice';
import { exec as ytdl } from 'youtube-dl-exec';
import https from 'https';
export interface TrackData {
  url: string;
  title: string;
  duration: number;
}
export class Track implements TrackData {
  public readonly url: string;
  public readonly title: string;
  public readonly duration: number;
  public constructor({ url, title, duration }: TrackData) {
    this.url = url;
    this.title = title;
    this.duration = duration;
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
    url = url.replace('youtu.be/', 'youtube.com/watch?v=');
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
              duration: item.durationSec ?? 0,
            }),
          );
      } else {
        const info = await getYouTubeVideoInfo(youTubeVideoIdFromUrl(url));
        tracks.push(
          new Track({
            title: info.title,
            duration: info.duration,
            url,
          }),
        );
      }
    }
    return tracks;
  }
}
export function youTubeVideoIdFromUrl(url: string) {
  if (url.includes('youtu.be')) return url.slice(url.indexOf('.be/') + 4);
  const andI = url.indexOf('&');
  return url.slice(url.indexOf('v=') + 2, andI === -1 ? undefined : andI);
}
export function getYouTubeVideoInfo(id: string): Promise<{
  title: string;
  duration: number;
}> {
  return new Promise((r, j) => {
    console.log(id);
    let body = '';
    const req = https.request(
      {
        hostname: 'youtubei.googleapis.com',
        path: '/youtubei/v1/player?key=AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8',
        method: 'POST',
      },
      res => {
        res.on('data', d => (body += d));
        res.once('end', () => {
          const titleI = body.indexOf('tit') + 9;
          const lengthI = body.indexOf('leng') + 17;
          r({
            title: body.slice(titleI, body.indexOf('"', titleI)),
            duration: +body.slice(lengthI, body.indexOf('"', lengthI)),
          });
        });
        res.on('error', j);
      },
    );
    req.on('error', j);
    req.write(
      JSON.stringify({
        context: {
          client: {
            hl: 'en',
            clientName: 'WEB',
            clientVersion: '2.20210721.00.00',
            mainAppWebInfo: {
              graftUrl: '/watch?v=' + id,
            },
          },
        },
        videoId: id,
      }),
    );
    req.end();
  });
}
