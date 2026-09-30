import { isIP } from 'node:net';

// The safe fetch of a pasted web page (PRD 774, decision 11). A member pastes a URL; the server then
// reads it, so the address must not reach inside the network the server runs in. Only `https:`, only a
// host whose every address is public (private, loopback, link-local, carrier-grade NAT, multicast and
// unspecified ranges refused, IPv4 in IPv6 read as IPv4), checked again after each redirect, which is
// followed by hand, five at most. At most 1 MB is read, the rest cut; the whole read takes at most 10
// seconds. HTML is reduced to its text. Every refusal throws a PageRefused, in plain words.
//
// The host's name is resolved here and again by the fetch itself, so a name that answers a public
// address first and a private one second slips through; the fetch sends no cookie and no key, and the
// answer is only read as text for the model.

/** Why a page is not read, in plain words. */
export class PageRefused extends Error {}

/** The most bytes of one page read. */
export const MAX_PAGE_BYTES = 1_000_000;
const PAGE_TIMEOUT_MS = 10_000;
const MAX_REDIRECTS = 5;

/** A host's addresses. */
export type Lookup = (host: string) => Promise<string[]>;

/** Node's resolver: every address of `host`. */
export const dnsLookup: Lookup = async (host) => {
  const { lookup } = await import('node:dns/promises');
  return (await lookup(host, { all: true })).map((a) => a.address);
};

function ipv4Private(address: string): boolean {
  const [a, b] = address.split('.').map(Number);
  return a === 0 || a === 10 || a === 127 || a >= 224
    || (a === 100 && b >= 64 && b <= 127)
    || (a === 169 && b === 254)
    || (a === 172 && b >= 16 && b <= 31)
    || (a === 192 && b === 168)
    || (a === 192 && b === 0 && Number(address.split('.')[2]) === 0)
    || (a === 198 && (b === 18 || b === 19));
}

/** Whether an address is not on the public internet. */
export function privateAddress(address: string): boolean {
  const ip = address.replace(/^\[|\]$/g, '').toLowerCase();
  if (isIP(ip) === 4) return ipv4Private(ip);
  if (isIP(ip) !== 6) return true;
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(ip);
  if (mapped) return ipv4Private(mapped[1]);
  if (/^::ffff:[0-9a-f]{1,4}:[0-9a-f]{1,4}$/.test(ip)) return true;
  return ip === '::' || ip === '::1' || /^f[cd]/.test(ip) || /^fe[89ab]/.test(ip) || /^ff/.test(ip);
}

/** The URL when it may be read: `https:`, and a host whose every address is public. Throws PageRefused. */
export async function checkUrl(raw: string, lookup: Lookup = dnsLookup): Promise<URL> {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    throw new PageRefused('That is not a web address.');
  }
  if (url.protocol !== 'https:') throw new PageRefused('Only https:// pages can be read.');
  if (url.username || url.password) throw new PageRefused('A web page with a password in its address cannot be read.');
  const host = url.hostname.replace(/^\[|\]$/g, '');
  let addresses: string[];
  if (isIP(host)) {
    addresses = [host];
  } else {
    if (!host.includes('.') || /\.(local|internal|localhost)$/i.test(host) || /^localhost$/i.test(host)) {
      throw new PageRefused('That address is not on the public internet.');
    }
    addresses = await lookup(host).catch(() => []);
    if (addresses.length === 0) throw new PageRefused('That address cannot be found.');
  }
  if (addresses.some(privateAddress)) throw new PageRefused('That address is not on the public internet.');
  return url;
}

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

/** An HTML page as its readable text: scripts, styles and tags removed, entities decoded, blank runs
 * folded. Text that is not HTML is kept as it is. */
export function htmlText(html: string): string {
  return html
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(script|style|noscript|svg|template)\b[\s\S]*?<\/\1\s*>/gi, ' ')
    .replace(/<\/?(p|div|br|li|h[1-6]|tr|section|article|header|footer|ul|ol|table)\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, name: string) => {
      if (name[0] === '#') {
        const code = name[1].toLowerCase() === 'x' ? Number.parseInt(name.slice(2), 16) : Number.parseInt(name.slice(1), 10);
        return Number.isFinite(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : ' ';
      }
      return ENTITIES[name.toLowerCase()] ?? whole;
    })
    .replace(/[ \t\f\v ]+/g, ' ')
    .replace(/\s*\n\s*/g, '\n')
    .trim();
}

/** At most `max` bytes of a body, the rest never read. */
async function cut(response: Response, max: number): Promise<string> {
  if (!response.body) return '';
  const reader = response.body.getReader();
  const parts: Uint8Array[] = [];
  let size = 0;
  while (size < max) {
    const { done, value } = await reader.read();
    if (done) break;
    parts.push(value.subarray(0, max - size));
    size += Math.min(value.byteLength, max - size);
  }
  await reader.cancel().catch(() => undefined);
  const all = new Uint8Array(size);
  let at = 0;
  for (const part of parts) {
    all.set(part, at);
    at += part.byteLength;
  }
  return new TextDecoder().decode(all);
}

export type PageOptions = { fetch?: typeof globalThis.fetch; lookup?: Lookup; timeoutMs?: number; maxBytes?: number };

/** A pasted page's text, read safely. Throws PageRefused when the address, a redirect or the answer is refused. */
export async function fetchPage(raw: string, { fetch = globalThis.fetch, lookup = dnsLookup, timeoutMs = PAGE_TIMEOUT_MS, maxBytes = MAX_PAGE_BYTES }: PageOptions = {}): Promise<string> {
  const signal = AbortSignal.timeout(timeoutMs);
  let url = await checkUrl(raw, lookup);
  for (let hop = 0; ; hop += 1) {
    let response: Response;
    try {
      response = await fetch(url, { redirect: 'manual', signal, headers: { accept: 'text/html, text/plain;q=0.9' }, cache: 'no-store' });
    } catch {
      throw new PageRefused('The page did not answer in time.');
    }
    if (response.status >= 300 && response.status < 400) {
      const next = response.headers.get('location');
      if (!next || hop >= MAX_REDIRECTS) throw new PageRefused('The page sends us on too far.');
      url = await checkUrl(new URL(next, url).toString(), lookup);
      continue;
    }
    if (!response.ok) throw new PageRefused(`The page answered ${response.status}.`);
    const type = response.headers.get('content-type') ?? '';
    if (type && !/^text\/|html|xml/i.test(type)) throw new PageRefused('The page is not text.');
    try {
      const body = await cut(response, maxBytes);
      return /html|xml/i.test(type) || /^\s*</.test(body) ? htmlText(body) : body.trim();
    } catch {
      throw new PageRefused('The page did not answer in time.');
    }
  }
}
