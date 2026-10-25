import { describe, expect, it } from 'vitest';
import { parseMetadataHints, parseTags, resolveInputUrl } from '../../src/infrastructure/web/requestParsing';

describe('resolveInputUrl', () => {
  it('uses a valid url field as-is without extraction', () => {
    expect(resolveInputUrl('https://en.wikipedia.org/wiki/Foo_(bar)', undefined))
      .toBe('https://en.wikipedia.org/wiki/Foo_(bar)');
  });

  it('extracts from the text field when url is missing', () => {
    expect(resolveInputUrl(undefined, '看這個 https://example.com/a 超讚')).toBe('https://example.com/a');
  });

  it('extracts from a url field that actually contains text', () => {
    expect(resolveInputUrl('check https://example.com/a', undefined)).toBe('https://example.com/a');
  });

  it('returns null for missing, non-string or non-http input', () => {
    expect(resolveInputUrl(undefined, undefined)).toBeNull();
    expect(resolveInputUrl(123, ['x'])).toBeNull();
    expect(resolveInputUrl('javascript:alert(1)', undefined)).toBeNull();
    expect(resolveInputUrl('', 'no link here')).toBeNull();
  });
});

describe('parseTags', () => {
  it('trims, drops empties and dedupes', () => {
    expect(parseTags([' a ', 'a', '', 'b'])).toEqual(['a', 'b']);
  });

  it('rejects non-arrays and non-string items', () => {
    expect(parseTags('a')).toBeNull();
    expect(parseTags(['a', 1])).toBeNull();
    expect(parseTags(undefined)).toBeNull();
  });

  it('rejects too many or too long tags', () => {
    expect(parseTags(Array.from({ length: 21 }, (_, i) => `t${i}`))).toBeNull();
    expect(parseTags(['x'.repeat(51)])).toBeNull();
    expect(parseTags(['x'.repeat(50)])).toEqual(['x'.repeat(50)]);
  });
});

describe('parseMetadataHints', () => {
  it('returns cleaned hints', () => {
    expect(parseMetadataHints({
      title: '  Hello \n  world ',
      description: 'desc',
      image: 'https://cdn.example.com/a.jpg'
    })).toEqual({ title: 'Hello world', description: 'desc', image: 'https://cdn.example.com/a.jpg' });
  });

  it('ignores invalid fields instead of failing the whole request', () => {
    expect(parseMetadataHints({ title: 42, image: 'javascript:alert(1)', description: 'ok' }))
      .toEqual({ title: undefined, description: 'ok', image: undefined });
  });

  it('truncates overly long text', () => {
    const hints = parseMetadataHints({ title: 'x'.repeat(500), description: 'y'.repeat(2000) });
    expect(hints?.title).toHaveLength(300);
    expect(hints?.description).toHaveLength(1000);
  });

  it('drops overly long image URLs', () => {
    expect(parseMetadataHints({ title: 't', image: `https://example.com/${'a'.repeat(2100)}` }))
      .toEqual({ title: 't', description: undefined, image: undefined });
  });

  it('returns undefined when nothing usable is provided', () => {
    expect(parseMetadataHints(undefined)).toBeUndefined();
    expect(parseMetadataHints('title')).toBeUndefined();
    expect(parseMetadataHints(['a'])).toBeUndefined();
    expect(parseMetadataHints({ title: '   ' })).toBeUndefined();
  });
});
