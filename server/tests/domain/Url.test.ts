import { describe, expect, it } from 'vitest';
import { Url } from '../../src/domain/entities/Url';

describe('Url entity', () => {
  it('defaults to ready status so legacy rows without status are shown as processed', () => {
    const url = new Url('1', 'https://example.com', {}, new Date());
    expect(url.status).toBe('ready');
    expect(url.ownerEmail).toBeNull();
  });

  it('rejects empty and malformed URLs', () => {
    expect(() => Url.create('')).toThrow('URL cannot be empty');
    expect(() => Url.create('not a url')).toThrow('Invalid URL format');
  });

  it('rejects non-http schemes that would become dangerous hrefs', () => {
    expect(() => Url.create('javascript:alert(1)')).toThrow('Invalid URL protocol');
    expect(() => Url.create('data:text/html,<script>alert(1)</script>')).toThrow('Invalid URL protocol');
  });

  it('keeps identity and status when metadata or tags change', () => {
    const url = Url.create('https://example.com', { title: 'a' }, 'me@example.com', 'pending');
    const updated = url.updateMetadata({ description: 'b' }).addTag('x');

    expect(updated.metadata).toMatchObject({ title: 'a', description: 'b', tags: ['x'] });
    expect(updated.status).toBe('pending');
    expect(updated.ownerEmail).toBe('me@example.com');
    expect(updated.withStatus('ready').status).toBe('ready');
  });

  it('does not add duplicate tags', () => {
    const url = Url.create('https://example.com').addTag('x').addTag('x');
    expect(url.metadata.tags).toEqual(['x']);
  });
});
