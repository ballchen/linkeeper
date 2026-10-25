import { describe, expect, it } from 'vitest';
import { HttpUrlAnalysisService } from '../../src/infrastructure/services/HttpUrlAnalysisService';

const service = new HttpUrlAnalysisService();

describe('HttpUrlAnalysisService', () => {
  it.each([
    ['https://www.facebook.com/user/posts/123', 'facebook', 'post'],
    ['https://m.facebook.com/watch/videos/1', 'facebook', 'video'],
    ['https://fb.watch/abc', 'facebook', 'post'],
    ['https://www.instagram.com/reel/ABC/', 'instagram', 'reel'],
    ['https://instagram.com/p/XYZ/', 'instagram', 'post'],
    ['https://www.threads.net/@u/post/1', 'threads', 'post'],
    ['https://www.threads.com/@u/post/1', 'threads', 'post'],
    ['https://www.youtube.com/shorts/abc', 'youtube', 'short'],
    ['https://www.youtube.com/watch?v=abc', 'youtube', 'video'],
    ['https://www.youtube.com/playlist?list=PL1', 'youtube', 'playlist']
  ])('%s -> %s/%s', async (url, source, detectedType) => {
    expect(await service.analyzeUrl(url)).toEqual({ source, detectedType });
  });

  it.each([
    'https://mythreadsblog.com/post',
    'https://notinstagram.com.evil.example/p/1',
    'https://youtube.com.evil.example/watch?v=1',
    'https://example.com/?ref=facebook.com'
  ])('does not misdetect look-alike domain %s', async (url) => {
    expect(await service.analyzeUrl(url)).toEqual({});
  });

  it('returns no source for invalid URLs', async () => {
    expect(await service.analyzeUrl('not a url')).toEqual({});
  });
});
