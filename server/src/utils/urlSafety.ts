import { lookup } from 'dns/promises';
import net from 'net';

/**
 * SSRF 防護：伺服器會對使用者提供的 URL 發出請求（抓 metadata、下載預覽圖），
 * 必須阻擋指向內網、loopback、link-local（雲端 metadata service）等目標的請求。
 */

const BLOCKED_HOSTNAMES = new Set(['localhost', 'metadata.google.internal']);

const isPrivateIPv4 = (ip: string): boolean => {
  const octets = ip.split('.').map(Number);
  if (octets.length !== 4 || octets.some(n => Number.isNaN(n))) return true;
  const [a, b] = octets;

  return (
    a === 0 ||                          // 0.0.0.0/8
    a === 10 ||                         // 10.0.0.0/8
    a === 127 ||                        // loopback
    (a === 100 && b >= 64 && b <= 127) || // 100.64.0.0/10 (CGNAT)
    (a === 169 && b === 254) ||         // link-local / cloud metadata
    (a === 172 && b >= 16 && b <= 31) || // 172.16.0.0/12
    (a === 192 && b === 0) ||           // 192.0.0.0/24 + 192.0.2.0/24 (doc)
    (a === 192 && b === 168) ||         // 192.168.0.0/16
    (a === 198 && (b === 18 || b === 19)) || // 198.18.0.0/15 (benchmark)
    a >= 224                            // multicast + reserved
  );
};

const isPrivateIp = (ip: string): boolean => {
  if (net.isIPv4(ip)) {
    return isPrivateIPv4(ip);
  }

  const normalized = ip.toLowerCase();

  // IPv4-mapped/compatible IPv6：URL parser 會正規化成 hex（::ffff:7f00:1），
  // 正常的公開 URL 不會用這種寫法，一律視為不安全
  if (normalized.startsWith('::ffff:') || /^::(\d+\.\d+\.\d+\.\d+)$/.test(normalized)) {
    return true;
  }

  return (
    normalized === '::' ||
    normalized === '::1' ||             // loopback
    normalized.startsWith('fc') ||      // fc00::/7 unique local
    normalized.startsWith('fd') ||
    normalized.startsWith('fe8') ||     // fe80::/10 link-local
    normalized.startsWith('fe9') ||
    normalized.startsWith('fea') ||
    normalized.startsWith('feb')
  );
};

/**
 * 同步檢查（不含 DNS）：協定與明顯的內部目標。
 * 用於 redirect 的每一跳（follow-redirects 的 hook 是同步的）。
 */
export const isObviouslyUnsafeTarget = (protocol: string, hostname: string): boolean => {
  if (protocol !== 'http:' && protocol !== 'https:') return true;

  const host = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (BLOCKED_HOSTNAMES.has(host) || host.endsWith('.localhost')) return true;
  if (net.isIP(host) && isPrivateIp(host)) return true;

  return false;
};

/**
 * 完整檢查：解析 DNS，所有解析出的 IP 都必須是公開位址。
 * URL 不安全時丟出 Error。
 */
export const assertSafeExternalUrl = async (rawUrl: string): Promise<URL> => {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error(`Invalid URL: ${rawUrl}`);
  }

  if (isObviouslyUnsafeTarget(parsed.protocol, parsed.hostname)) {
    throw new Error(`Blocked unsafe URL target: ${parsed.hostname}`);
  }

  const host = parsed.hostname.replace(/^\[|\]$/g, '');
  if (!net.isIP(host)) {
    let addresses;
    try {
      addresses = await lookup(host, { all: true });
    } catch {
      throw new Error(`Cannot resolve hostname: ${host}`);
    }

    if (addresses.length === 0 || addresses.some(addr => isPrivateIp(addr.address))) {
      throw new Error(`Blocked URL resolving to a private address: ${host}`);
    }
  }

  return parsed;
};

/**
 * axios/follow-redirects 的 beforeRedirect hook：檢查 redirect 的每一跳。
 * （hook 為同步，僅做不含 DNS 的檢查）
 */
export const blockUnsafeRedirect = (options: { protocol?: string; hostname?: string; host?: string }): void => {
  const hostname = options.hostname || options.host || '';
  if (isObviouslyUnsafeTarget(options.protocol || 'http:', hostname)) {
    throw new Error(`Blocked redirect to unsafe target: ${hostname}`);
  }
};
