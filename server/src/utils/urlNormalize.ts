/**
 * 從任意文字抽出第一個 http(s) URL。
 * iOS 分享選單裡，IG / Threads / FB 等 app 常給「一段含網址的文字」而非純 URL。
 */
const URL_IN_TEXT_REGEX = /https?:\/\/[^\s<>"'，。、）」』]+/i;

/* 句尾常黏在網址後面的標點 */
const TRAILING_PUNCTUATION = new Set(['.', ',', '!', '?', ';', ':', "'", '"', ']', ')']);

const count = (text: string, char: string): number => text.split(char).length - 1;

export const extractUrlFromText = (text: string): string | null => {
  const match = text.match(URL_IN_TEXT_REGEX);
  if (!match) return null;

  let url = match[0];
  while (url.length > 0 && TRAILING_PUNCTUATION.has(url[url.length - 1])) {
    // 成對的括號屬於網址本身，例如 https://en.wikipedia.org/wiki/Foo_(bar)
    if (url.endsWith(')') && count(url, '(') >= count(url, ')')) break;
    url = url.slice(0, -1);
  }
  return url;
};

export const isHttpUrl = (value: string): boolean => {
  try {
    const { protocol } = new URL(value);
    return protocol === 'http:' || protocol === 'https:';
  } catch {
    return false;
  }
};

/* 任何網站都可以安全移除的追蹤參數 */
const GLOBAL_TRACKING_PARAMS = new Set([
  'fbclid', 'gclid', 'dclid', 'msclkid', 'mc_eid', 'igsh', 'igshid', 'mibextid'
]);

/* 只在特定網站移除的分享參數（在其他網站可能有意義） */
const SITE_TRACKING_PARAMS: { hosts: string[]; params: string[] }[] = [
  { hosts: ['youtube.com', 'youtu.be'], params: ['si', 'feature', 'pp'] },
  { hosts: ['threads.net', 'threads.com'], params: ['xmt', 'slof'] },
  { hosts: ['facebook.com', 'fb.com', 'fb.watch'], params: ['rdid', 'share_url', 'sfnsn'] },
  { hosts: ['instagram.com'], params: ['img_index'] }
];

const matchesHost = (hostname: string, host: string): boolean =>
  hostname === host || hostname.endsWith(`.${host}`);

/**
 * 正規化 URL 以便去重：移除追蹤參數與一般錨點。
 * 同一則 IG 貼文每次分享的 igsh 都不同，不正規化就會被存成多筆。
 * 無法解析時原樣回傳，交給 Url entity 驗證。
 */
export const normalizeUrl = (rawUrl: string): string => {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl.trim());
  } catch {
    return rawUrl.trim();
  }

  const hostname = parsed.hostname.toLowerCase();
  const siteParams = SITE_TRACKING_PARAMS
    .filter(rule => rule.hosts.some(host => matchesHost(hostname, host)))
    .flatMap(rule => rule.params);

  for (const key of [...parsed.searchParams.keys()]) {
    const lower = key.toLowerCase();
    if (lower.startsWith('utm_') || GLOBAL_TRACKING_PARAMS.has(lower) || siteParams.includes(lower)) {
      parsed.searchParams.delete(key);
    }
  }

  // 一般錨點可移除；#/、#! 是 SPA 的路由，保留
  if (!/^#[/!]/.test(parsed.hash)) {
    parsed.hash = '';
  }
  return parsed.toString();
};
