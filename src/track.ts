import ytpl from 'ytpl';
import { AudioResource, createAudioResource, demuxProbe } from '@discordjs/voice';
//import { exec as ytdl } from 'youtube-dl-exec';
import ytdl from 'ytdl-core';
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
  public async createAudioResource(): Promise<AudioResource<Track>> {
    const info = await ytdl.getInfo(this.url, {
      requestOptions: {
        headers: {
          cookie:
            'LOGIN_INFO=AFmmF2swRAIgZuk02acRA13AOSoq0p-AsRVSB5F5u9U1c6W-NzKVqOoCIAfN99iTYoO04NafrRYs_SxMuWmxFjNwAkFKmFPz2sxo:QUQ3MjNmd0dUZlRoanlIQmR0M3ZOMjQ4RkpCZjhYeEFDeVlwelJvTUZkbWdueWdzbjNzZGxuU2MteGs2ckpzX3hBNkljSmxBZjNHZFoxdGZNVDhZOFlyX0tnaWFrMGFKWUotZEQtSW5wY3k1V1BnTXRCekF3NzhIZm8tc2V3RlRYdXBfb1EtWmhGYVFjQk1fajVyV2pJVVlBZnNsak5fMHlDVEVUNFpBOG5mSDIxYWt3ekVnMXhUN2RyeWE4THBIWVBHcF9UeVJ2OERNS01oUklDbENJWGFoUDZTQ09fcVVJZw==; VISITOR_INFO1_LIVE=FyJxjrvnuKU; SID=DQhCG08wV6mFmwd5l-WUg8B71c38ZEPDgecJ537T734WHal-5Y7H5hjVewNNUA-tQCmafw.; __Secure-1PSID=DQhCG08wV6mFmwd5l-WUg8B71c38ZEPDgecJ537T734WHal-SN0Mg82EIKnGm0aJGuOrWg.; __Secure-3PSID=DQhCG08wV6mFmwd5l-WUg8B71c38ZEPDgecJ537T734WHal-AIDTbh101PBgnFmZs0qwgA.; HSID=Az6rj5B1S0mNSrK3N; SSID=AfiltjL6MjlK-M6Zj; APISID=NTYOIpN0YPGCUJq6/Au3Kyeaa5a2gW3QGE; SAPISID=E5aLipTKv9UDlcuT/ATktswflKcOj4frR5; __Secure-1PAPISID=E5aLipTKv9UDlcuT/ATktswflKcOj4frR5; __Secure-3PAPISID=E5aLipTKv9UDlcuT/ATktswflKcOj4frR5; PREF=tz=Europe.Moscow&f6=40000000; YSC=6ROaDNt-2Tk; SIDCC=AJi4QfFWxaTMU_Rm3ivyFf8mOoXQld-qGcc9KvuoXrT_VKUHeEdZp-FeL84Glq1PWM31WetLdg; __Secure-3PSIDCC=AJi4QfFsovjb5i5WgJ2YmJikw4Os0zDebhFPQAdhjQTRzSFnxIbshu0pdKXGX8Mi7l0U-ieXcQ',
        },
      },
    });
    let formats = info.formats.filter(f => f.hasAudio && (!info.videoDetails.isLiveContent || f.isHLS));
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
        //const info = await getYouTubeVideoInfo(youTubeVideoIdFromUrl(url));
        const info = await ytdl.getBasicInfo(url, {
          requestOptions: {
            headers: {
              cookie:
                'LOGIN_INFO=AFmmF2swRAIgZuk02acRA13AOSoq0p-AsRVSB5F5u9U1c6W-NzKVqOoCIAfN99iTYoO04NafrRYs_SxMuWmxFjNwAkFKmFPz2sxo:QUQ3MjNmd0dUZlRoanlIQmR0M3ZOMjQ4RkpCZjhYeEFDeVlwelJvTUZkbWdueWdzbjNzZGxuU2MteGs2ckpzX3hBNkljSmxBZjNHZFoxdGZNVDhZOFlyX0tnaWFrMGFKWUotZEQtSW5wY3k1V1BnTXRCekF3NzhIZm8tc2V3RlRYdXBfb1EtWmhGYVFjQk1fajVyV2pJVVlBZnNsak5fMHlDVEVUNFpBOG5mSDIxYWt3ekVnMXhUN2RyeWE4THBIWVBHcF9UeVJ2OERNS01oUklDbENJWGFoUDZTQ09fcVVJZw==; VISITOR_INFO1_LIVE=FyJxjrvnuKU; SID=DQhCG08wV6mFmwd5l-WUg8B71c38ZEPDgecJ537T734WHal-5Y7H5hjVewNNUA-tQCmafw.; __Secure-1PSID=DQhCG08wV6mFmwd5l-WUg8B71c38ZEPDgecJ537T734WHal-SN0Mg82EIKnGm0aJGuOrWg.; __Secure-3PSID=DQhCG08wV6mFmwd5l-WUg8B71c38ZEPDgecJ537T734WHal-AIDTbh101PBgnFmZs0qwgA.; HSID=Az6rj5B1S0mNSrK3N; SSID=AfiltjL6MjlK-M6Zj; APISID=NTYOIpN0YPGCUJq6/Au3Kyeaa5a2gW3QGE; SAPISID=E5aLipTKv9UDlcuT/ATktswflKcOj4frR5; __Secure-1PAPISID=E5aLipTKv9UDlcuT/ATktswflKcOj4frR5; __Secure-3PAPISID=E5aLipTKv9UDlcuT/ATktswflKcOj4frR5; PREF=tz=Europe.Moscow&f6=40000000; YSC=6ROaDNt-2Tk; SIDCC=AJi4QfFWxaTMU_Rm3ivyFf8mOoXQld-qGcc9KvuoXrT_VKUHeEdZp-FeL84Glq1PWM31WetLdg; __Secure-3PSIDCC=AJi4QfFsovjb5i5WgJ2YmJikw4Os0zDebhFPQAdhjQTRzSFnxIbshu0pdKXGX8Mi7l0U-ieXcQ',
            },
          },
        });
        tracks.push(
          new Track({
            title: info.videoDetails.title,
            duration: +info.videoDetails.lengthSeconds,
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
            title: body.slice(titleI, body.indexOf('",\n', titleI)),
            duration: +body.slice(lengthI, body.indexOf('",\n', lengthI)),
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
