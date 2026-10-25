import { describe, expect, it } from 'vitest';
import { extractUrlFromText, isHttpUrl, normalizeUrl } from '../../src/utils/urlNormalize';

describe('extractUrlFromText', () => {
  it('returns null when there is no URL', () => {
    expect(extractUrlFromText('沒有網址的訊息')).toBeNull();
    expect(extractUrlFromText('')).toBeNull();
  });

  it('extracts a URL surrounded by Chinese text and full-width punctuation', () => {
    expect(extractUrlFromText('看看這個 https://www.instagram.com/reel/ABC/?igsh=1，超好笑'))
      .toBe('https://www.instagram.com/reel/ABC/?igsh=1');
    expect(extractUrlFromText('（https://example.com/a）')).toBe('https://example.com/a');
  });

  it('strips trailing sentence punctuation', () => {
    expect(extractUrlFromText('Read https://example.com/post.')).toBe('https://example.com/post');
    expect(extractUrlFromText('Really? https://example.com/q?x=1!?')).toBe('https://example.com/q?x=1');
  });

  it('keeps balanced parentheses that belong to the URL', () => {
    expect(extractUrlFromText('see https://en.wikipedia.org/wiki/Foo_(bar)'))
      .toBe('https://en.wikipedia.org/wiki/Foo_(bar)');
    expect(extractUrlFromText('(see https://example.com/page)')).toBe('https://example.com/page');
  });

  it('returns only the first URL', () => {
    expect(extractUrlFromText('https://a.example/1 and https://b.example/2')).toBe('https://a.example/1');
  });
});

describe('isHttpUrl', () => {
  it.each([
    ['https://example.com', true],
    ['http://example.com/path', true],
    ['javascript:alert(1)', false],
    ['ftp://example.com', false],
    ['example.com', false],
    ['', false]
  ])('%s -> %s', (input, expected) => {
    expect(isHttpUrl(input)).toBe(expected);
  });
});

describe('normalizeUrl', () => {
  it('removes global tracking parameters on any site', () => {
    expect(normalizeUrl('https://example.com/a?utm_source=x&utm_medium=y&id=5&fbclid=abc'))
      .toBe('https://example.com/a?id=5');
  });

  it('removes Instagram share ids so the same post dedupes', () => {
    expect(normalizeUrl('https://www.instagram.com/reel/ABC/?igsh=one'))
      .toBe(normalizeUrl('https://www.instagram.com/reel/ABC/?igsh=two'));
  });

  it('removes YouTube share params but keeps the video id', () => {
    expect(normalizeUrl('https://youtu.be/dQw4w9WgXcQ?si=abc123')).toBe('https://youtu.be/dQw4w9WgXcQ');
    expect(normalizeUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ&feature=shared&t=42'))
      .toBe('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42');
  });

  it('only strips site-specific params on that site', () => {
    // si 對其他網站可能有意義
    expect(normalizeUrl('https://example.com/?si=keep')).toBe('https://example.com/?si=keep');
    expect(normalizeUrl('https://www.threads.net/@u/post/1?xmt=abc')).toBe('https://www.threads.net/@u/post/1');
  });

  it('removes plain anchors but keeps SPA hash routes', () => {
    expect(normalizeUrl('https://example.com/doc#section-2')).toBe('https://example.com/doc');
    expect(normalizeUrl('https://example.com/#/inbox/1')).toBe('https://example.com/#/inbox/1');
    expect(normalizeUrl('https://example.com/#!/page')).toBe('https://example.com/#!/page');
  });

  it('treats tracking param names case-insensitively', () => {
    expect(normalizeUrl('https://example.com/?UTM_Source=x&FBCLID=y')).toBe('https://example.com/');
  });

  it('returns unparseable input trimmed and unchanged', () => {
    expect(normalizeUrl('  not a url  ')).toBe('not a url');
  });
});
