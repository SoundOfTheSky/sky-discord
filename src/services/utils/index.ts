export type MakeOptional<Type, Key extends keyof Type> = Omit<Type, Key> & Partial<Pick<Type, Key>>;

export const wait = (time: number) => new Promise((r) => setTimeout(r, time));
export function log(...agrs: unknown[]) {
  console.log(new Date().toLocaleString('ru'), ...agrs);
}
export function formatBytes(bytes: number) {
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  if (!bytes) return `0B`;
  const pow = Math.floor(Math.log(bytes) / Math.log(1024));
  const maxPow = Math.min(pow, sizes.length - 1);
  return `${Number.parseFloat((bytes / Math.pow(1024, maxPow)).toFixed(2))}${sizes[maxPow]!}`;
}
export class ValidationError extends Error {
  override name = 'ValidationError';
}

export class CountBytesTransform<T extends { length: number }> extends TransformStream<T> {
  constructor(str: string, logInterval: number, maxSize?: number) {
    let bytes = 0;
    const start = Date.now();
    let lastBytes = 0;
    super({
      transform(chunk, controller) {
        bytes += chunk.length;
        controller.enqueue(chunk);
      },
      flush() {
        clearInterval(interval);
        log('Done!');
      },
    });
    const interval = setInterval(() => {
      let msg = str;
      const speed = (bytes - lastBytes) / logInterval;
      msg = msg
        .replace('%b', formatBytes(bytes))
        .replace('%t', formatTime(Date.now() - start, 1000))
        .replace('%s', formatBytes(speed));
      if (maxSize) {
        msg = msg
          .replace('%lt', formatTime(Math.floor((maxSize - bytes) / speed) * 1000))
          .replace('%p', Math.floor((bytes / maxSize) * 100).toString())
          .replace('%s', formatBytes(maxSize));
      }
      log(msg);
      lastBytes = bytes;
    }, logInterval * 1000);
  }
}

export const camelToSnakeCase = (str: string) => str.replaceAll(/[A-Z]+/g, (letter) => `_${letter.toLowerCase()}`);
// eslint-disable-next-line @typescript-eslint/no-empty-function
export const noop = () => {};
export const clearTags = (
  text: string,
  whitelist: string[] = [
    'accent', // Current subject [any]
    'subject', // Link another subject [any](uid=number)
    'example', // example sentence? [any]
    'audio', // Audio [any] (s="link")
    'warning', // Warning text [any]
    'ik', // ImmersionKit query [text]
    'tab', // Tabs always at root [any] title="text"
    'img',
    'ruby',
    'rt',
    'rp',
    'a',
  ],
) =>
  ([...text.matchAll(/<.+?>/g)].map((el) => [el[0].slice(1, -1).split(' ')[0], el.index]) as [string, number][])
    .filter(([t]) => whitelist.every((w) => t !== w && t !== `/${w}`))
    .reverse()
    .reduce((acc, [, index]) => acc.slice(0, index) + acc.slice(acc.indexOf('>', index) + 1), text);
export const parseFuriganaToRuby = (str: string) =>
  str.replaceAll(
    /([\u4E00-\u9FAF]+?)（([\u3040-\u309F]+?)）/gsu,
    (_, a: string, b: string) => `<ruby>${a}<rp>(</rp><rt>${b}</rt><rp>)</rp></ruby>`,
  );
export const cleanupHTML = (str: string) =>
  clearTags(str.replaceAll(/<br>/gs, '\n'))
    .split('\n')
    .map((el) => el.trim())
    .join('\n')
    .replaceAll(/\s{2,}/g, '\n');

export function createCashedFunction<T, V extends unknown[]>(fn: (...args: V) => T) {
  const hash = new Map<string, T>();
  return [
    (...args: V) => {
      const key = JSON.stringify(args);
      const value = hash.get(key);
      if (value) return value;
      const newValue = fn(...args);
      hash.set(key, newValue);
      return newValue;
    },
    (...args: V) => hash.delete(JSON.stringify(args)),
    hash,
  ] as const;
}
export function createCashedAsyncFunction<T, V extends unknown[]>(fn: (...args: V) => Promise<T>) {
  const hash = new Map<string, T>();
  return [
    async (...args: V) => {
      const key = JSON.stringify(args);
      const value = hash.get(key);
      if (value) return value;
      const newValue = await fn(...args);
      hash.set(key, newValue);
      return newValue;
    },
    (...args: V) => hash.delete(JSON.stringify(args)),
    hash,
  ] as const;
}
export function swap<T>(arr: T[], i: number, i2: number) {
  const temp = arr[i2]!;
  arr[i2] = arr[i]!;
  arr[i] = temp;
  return arr;
}
export function binarySearch(size: number, compare: (index: number) => number) {
  let low = 0;
  let high = size - 1;
  let position = -1;
  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const compared = compare(mid);
    if (compared === 0) {
      position = mid;
      break;
    } else if (compared > 0) high = mid - 1;
    else low = mid + 1;
  }
  return position;
}
export function cutNumber(n: number, symbols: number) {
  let text = String(n);
  text = text.slice(0, Math.max(text.indexOf('.'), symbols));
  if (text.endsWith('.')) text = text.slice(0, -1);
  return text;
}
export async function retry<T>(fn: () => Promise<T>, retries: number, interval: number | number[] = 0): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (retries === 0) throw error;
    await wait(Array.isArray(interval) ? interval[interval.length - retries]! : interval);
    return retry(fn, retries - 1, interval);
  }
}
export function formatTime(time: number, min = 1) {
  const ranges = [
    [31_536_000_000, 'y'],
    [86_400_000, 'd'],
    [3_600_000, 'h'],
    [60_000, 'm'],
    [1000, 's'],
    [1, 'ms'],
  ] as const;
  let output = '';
  for (const [ms, title] of ranges) {
    if (min && time < min) break;
    if (time < ms) continue;
    const val = Math.floor(time / ms);
    if (val !== 0) output += ` ${val}${title}`;
    time %= ms;
  }
  return output;
}
export function random(min: number, max: number, float?: boolean): number {
  const number_ = Math.random() * (max - min) + min;
  return float ? number_ : Math.round(number_);
}
export function shuffleArray<T>(arr: T[]): T[] {
  const array = [...arr];
  for (let i = 0; i < array.length; i++) {
    const i2 = Math.floor(Math.random() * array.length);
    const buf = array[i2]!;
    array[i2] = array[i]!;
    array[i] = buf;
  }
  return array;
}
