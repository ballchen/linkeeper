import { describe, expect, it } from 'vitest';
import { assertSafeExternalUrl, blockUnsafeRedirect, isObviouslyUnsafeTarget } from '../../src/utils/urlSafety';

describe('isObviouslyUnsafeTarget', () => {
  it.each([
    ['file:', 'example.com'],
    ['ftp:', 'example.com'],
    ['http:', 'localhost'],
    ['http:', 'api.localhost'],
    ['http:', 'metadata.google.internal'],
    ['http:', '127.0.0.1'],
    ['http:', '10.1.2.3'],
    ['http:', '172.16.0.1'],
    ['http:', '192.168.1.1'],
    ['http:', '169.254.169.254'],
    ['http:', '100.64.0.1'],
    ['http:', '0.0.0.0'],
    ['http:', '[::1]'],
    ['http:', '[fd00::1]'],
    ['http:', '[fe80::1]'],
    ['http:', '[::ffff:7f00:1]']
  ])('blocks %s//%s', (protocol, hostname) => {
    expect(isObviouslyUnsafeTarget(protocol, hostname)).toBe(true);
  });

  it.each([
    ['https:', 'example.com'],
    ['http:', '8.8.8.8'],
    ['https:', '172.32.0.1'],
    ['https:', '[2606:4700::1111]']
  ])('allows %s//%s', (protocol, hostname) => {
    expect(isObviouslyUnsafeTarget(protocol, hostname)).toBe(false);
  });
});

describe('assertSafeExternalUrl', () => {
  it('rejects malformed URLs and private IP literals without DNS', async () => {
    await expect(assertSafeExternalUrl('not a url')).rejects.toThrow('Invalid URL');
    await expect(assertSafeExternalUrl('http://127.0.0.1:27017/')).rejects.toThrow('Blocked');
    await expect(assertSafeExternalUrl('http://169.254.169.254/latest/meta-data')).rejects.toThrow('Blocked');
  });

  it('accepts public IP literals', async () => {
    const parsed = await assertSafeExternalUrl('https://8.8.8.8/');
    expect(parsed.hostname).toBe('8.8.8.8');
  });
});

describe('blockUnsafeRedirect', () => {
  it('throws on redirects to internal targets', () => {
    expect(() => blockUnsafeRedirect({ protocol: 'http:', hostname: '127.0.0.1' })).toThrow('Blocked redirect');
    expect(() => blockUnsafeRedirect({ protocol: 'https:', hostname: 'example.com' })).not.toThrow();
  });
});
