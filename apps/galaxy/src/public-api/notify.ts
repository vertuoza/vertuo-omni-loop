import type { Notifier, Ping } from '../runners/runners.contract';

// The ping a key-sent job makes (PRD 2425 s8, spec §10): when a job sent with a `notify_url` changes status,
// outcome or questions, its address gets `{job_id, event, at}` and nothing else. This module is the part with no
// I/O of its own: which addresses a ping may reach, the retries, the logging. The resolver, the post, the clock
// and the hand-over to "after the response" come in as `NotifyDeps`; `notify.live.ts` wires the real ones.
//
// The link is the caller's, so the host it names is untrusted (SSRF): https only, no credentials in the link,
// the host resolved and every address it resolves to public, and that again before every try. The post goes to
// the address just checked, never to a second lookup of the name (a name can answer differently the second
// time), and follows no redirect: that is the live post's job, and `PingRequest` is what it receives.

/** Three tries, each cut at 5 seconds, the waits between them: 3 x 5 + 5 + 10 = 30 seconds at most. */
export const PING_TRIES = 3;
export const PING_TIMEOUT_MS = 5_000;
export const PING_WAITS_MS = [5_000, 10_000] as const;

export type AddressKind = 'public' | 'loopback' | 'private' | 'link-local' | 'reserved';

type Octets = readonly [number, number, number, number];

/** A dotted IPv4 address, each part plain decimal with no leading zero (so no octal or hex reading), or null. */
function octetsOf(text: string): Octets | null {
  const parts = text.split('.');
  if (parts.length !== 4) return null;
  const values = parts.map((part) => (/^(0|[1-9]\d{0,2})$/.test(part) ? Number(part) : -1));
  const [a = -1, b = -1, c = -1, d = -1] = values;
  return [a, b, c, d].every((value) => value >= 0 && value <= 255) ? [a, b, c, d] : null;
}

/** Whether two numbers agree but for their `free` last bits. Plain arithmetic: the bit operators read 32 bits as signed. */
const sameBits = (x: number, y: number, free: number): boolean => Math.floor(x / 2 ** free) === Math.floor(y / 2 ** free);

const numberOf = ([a, b, c, d]: Octets): number => ((a * 256 + b) * 256 + c) * 256 + d;

/** The IPv4 blocks that are not public: where each starts, how many of its leading bits name it, and what it is. */
const V4_BLOCKS: readonly (readonly [Octets, number, AddressKind])[] = [
  [[0, 0, 0, 0], 8, 'reserved'],
  [[10, 0, 0, 0], 8, 'private'],
  [[100, 64, 0, 0], 10, 'private'], // carrier-grade NAT
  [[127, 0, 0, 0], 8, 'loopback'],
  [[169, 254, 0, 0], 16, 'link-local'],
  [[172, 16, 0, 0], 12, 'private'],
  [[192, 0, 0, 0], 24, 'reserved'], // protocol assignments
  [[192, 0, 2, 0], 24, 'reserved'], // documentation
  [[192, 88, 99, 0], 24, 'reserved'], // the retired 6to4 relay
  [[192, 168, 0, 0], 16, 'private'],
  [[198, 18, 0, 0], 15, 'reserved'], // benchmarking
  [[198, 51, 100, 0], 24, 'reserved'], // documentation
  [[203, 0, 113, 0], 24, 'reserved'], // documentation
  [[224, 0, 0, 0], 3, 'reserved'], // multicast, the reserved block, the broadcast address
];

function kindOfV4(octets: Octets): AddressKind {
  const address = numberOf(octets);
  const found = V4_BLOCKS.find(([start, bits]) => sameBits(address, numberOf(start), 32 - bits));
  return found?.[2] ?? 'public';
}

const HEX_GROUP = /^[0-9a-f]{1,4}$/i;

/** What one token of an IPv6 address stands for: a hex group (one number), or, on the last token of the address, a dotted IPv4 (two). */
function groupsOfToken(token: string, last: boolean): number[] | null {
  if (last && token.includes('.')) {
    const octets = octetsOf(token);
    return octets === null ? null : [octets[0] * 256 + octets[1], octets[2] * 256 + octets[3]];
  }
  return HEX_GROUP.test(token) ? [Number.parseInt(token, 16)] : null;
}

/** The groups of one side of an IPv6 address; the last token of the side that ends the address may be a dotted IPv4. */
function groupsOfSide(side: string, ends: boolean): number[] | null {
  const tokens = side === '' ? [] : side.split(':');
  const parsed = tokens.map((token, index) => groupsOfToken(token, ends && index === tokens.length - 1));
  return parsed.every((groups): groups is number[] => groups !== null) ? parsed.flat() : null;
}

/** The eight groups when the `::` stands for the zeros between the two sides (at least one group), or null. */
const spread = (head: number[], tail: number[]): number[] | null =>
  head.length + tail.length > 7 ? null : [...head, ...new Array<number>(8 - head.length - tail.length).fill(0), ...tail];

/** The eight 16-bit groups of an IPv6 address (a zone after `%` is dropped), or null when the text is none. */
function groupsOf(address: string): number[] | null {
  const [bare = ''] = address.split('%');
  const sides = bare.split('::');
  if (!bare.includes(':') || sides.length > 2) return null;
  const [front = '', back] = sides;
  if (back === undefined) {
    const whole = groupsOfSide(front, true);
    return whole?.length === 8 ? whole : null;
  }
  const head = groupsOfSide(front, false);
  const tail = groupsOfSide(back, true);
  return head === null || tail === null ? null : spread(head, tail);
}

/** An IPv6 block: its leading groups (the rest are zero), how many bits of them name it, and what it is: a kind, or an IPv4 address
 * it carries in the two groups from `v4At`. */
type V6Block = { prefix: readonly number[]; bits: number; is: AddressKind | { v4At: number } };

/** What the IPv6 blocks say, a narrow block before the wider one that holds it; an address in none is not public (outside 2000::/3). */
const V6_BLOCKS: readonly V6Block[] = [
  { prefix: [0, 0, 0, 0, 0, 0, 0, 1], bits: 128, is: 'loopback' }, // ::1
  { prefix: [], bits: 96, is: 'reserved' }, // :: and the retired ::a.b.c.d
  { prefix: [0, 0, 0, 0, 0, 0xffff], bits: 96, is: { v4At: 6 } }, // an IPv4 address in IPv6 clothes
  { prefix: [0x64, 0xff9b], bits: 96, is: { v4At: 6 } }, // NAT64
  { prefix: [0x2002], bits: 16, is: { v4At: 1 } }, // 6to4: the IPv4 address it tunnels to
  { prefix: [0xfe80], bits: 10, is: 'link-local' },
  { prefix: [0xfec0], bits: 10, is: 'private' }, // site-local (retired)
  { prefix: [0xfc00], bits: 7, is: 'private' }, // unique local
  { prefix: [0x2001], bits: 23, is: 'reserved' }, // protocol assignments, Teredo included
  { prefix: [0x2001, 0xdb8], bits: 32, is: 'reserved' }, // documentation
  { prefix: [0x3fff], bits: 20, is: 'reserved' }, // documentation
  { prefix: [0x2000], bits: 3, is: 'public' }, // the global unicast block
];

/** Whether the groups start with the block's leading bits: each group is held to as many of its 16 bits as the block names. */
const inBlock = (groups: readonly number[], { prefix, bits }: V6Block): boolean =>
  groups.every((group, index) => sameBits(group, prefix[index] ?? 0, 16 - Math.min(16, Math.max(0, bits - index * 16))));

function kindOfV6(groups: readonly number[]): AddressKind {
  const block = V6_BLOCKS.find((candidate) => inBlock(groups, candidate));
  if (block === undefined) return 'reserved';
  if (typeof block.is === 'string') return block.is;
  const [high = 0, low = 0] = groups.slice(block.is.v4At, block.is.v4At + 2);
  return kindOfV4([high >> 8, high & 0xff, low >> 8, low & 0xff]);
}

/** What an address is: only `public` is one a ping may reach. Text that is no address is `reserved`. */
export function kindOfAddress(address: string): AddressKind {
  const octets = octetsOf(address);
  if (octets !== null) return kindOfV4(octets);
  const groups = groupsOf(address);
  return groups === null ? 'reserved' : kindOfV6(groups);
}

/** What the live post receives: the link as the caller gave it, and the address to connect to, which is the
 *  one just checked. It answers the status code and rejects on a network error; it follows no redirect. */
export type PingRequest = { url: string; address: string; body: string; signal: AbortSignal };

export type NotifyNet = {
  resolve: (host: string) => Promise<string[]>;
  fetch: (request: PingRequest) => Promise<number>;
};

export type NotifyDeps = {
  net: NotifyNet;
  sleep: (ms: number) => Promise<void>;
  /** Calls `fire` after `ms` unless the returned function is called first. */
  timer: (ms: number, fire: () => void) => () => void;
  log: (line: string) => void;
  /** Hands a task over to run once the response has gone (Next's after()). */
  later: (task: () => Promise<void>) => void;
};

/** Why a link may not be pinged. `retry` marks a refusal that a later try may not see again: a resolver that
 *  failed, as against a link or an address that is no good. */
type Refusal = { refusal: string; host: string; retry: boolean };

/** A link that may be pinged (the address to connect to), or why it may not. */
type Vetting = { address: string; host: string } | Refusal;

const refuse = (refusal: string, host: string, retry = false): Refusal => ({ refusal, host, retry });

const reasonOf = (error: unknown): string => (error instanceof Error ? error.message : 'unknown error');

const aKind = (kind: AddressKind): string => `a ${kind} address`;

/** What the link says before any lookup: a refusal, or the link read and the host it names. */
function readLink(link: string): Refusal | { url: URL; host: string } {
  let url: URL;
  try {
    url = new URL(link);
  } catch {
    return refuse('is not a link', 'an unreadable link');
  }
  const host = url.hostname.replace(/^\[|\]$/g, '');
  if (url.protocol !== 'https:') return refuse('must be an https link', host);
  if (url.username !== '' || url.password !== '') return refuse('must not carry a user name or a password', host);
  return { url, host };
}

/** A host that is an address itself, read once as what it is. */
function vetLiteral(host: string): Vetting {
  const kind = kindOfAddress(host);
  return kind === 'public' ? { address: host, host } : refuse(`is ${aKind(kind)}, not a public one`, host);
}

/** A host that is a name: every address it resolves to must be public, and the post goes to the first. */
async function vetName(host: string, net: NotifyNet): Promise<Vetting> {
  let addresses: string[];
  try {
    addresses = await net.resolve(host);
  } catch {
    return refuse(`${host} does not resolve`, host, true);
  }
  const [first] = addresses;
  if (first === undefined) return refuse(`${host} does not resolve`, host, true);
  const kept = addresses.map(kindOfAddress).find((kind) => kind !== 'public');
  return kept === undefined ? { address: first, host } : refuse(`${host} resolves to ${aKind(kept)}, which is not public`, host);
}

async function vet(link: string, net: NotifyNet): Promise<Vetting> {
  const read = readLink(link);
  if ('refusal' in read) return read;
  const { url, host } = read;
  // The URL parser has already turned the other spellings of an address (decimal, hex, octal, short) into the
  // dotted or the bracketed one, so a literal is read here once, as what it is.
  return url.hostname.startsWith('[') || octetsOf(host) !== null ? vetLiteral(host) : vetName(host, net);
}

export function notifier({ net, sleep, timer, log, later }: NotifyDeps): Notifier {
  const give = (ping: Ping, host: string, why: string): void => {
    // The job, the event and the host: the rest of the link (a path, a query) may carry a secret.
    log(`ping ${ping.jobId} (${ping.event}) to ${host} was not delivered: ${why}`);
  };

  /** One try: the host checked again, then one post cut at 5 seconds. */
  async function attempt(ping: Ping): Promise<{ sent: true } | { sent: false; host: string; why: string; retry: boolean }> {
    const vetting = await vet(ping.url, net);
    if ('refusal' in vetting) return { sent: false, host: vetting.host, why: vetting.refusal, retry: vetting.retry };
    const controller = new AbortController();
    const stop = timer(PING_TIMEOUT_MS, () => { controller.abort(); });
    try {
      const body = JSON.stringify({ job_id: ping.jobId, event: ping.event, at: ping.at });
      const status = await net.fetch({ url: ping.url, address: vetting.address, body, signal: controller.signal });
      return status >= 200 && status < 300 ? { sent: true } : { sent: false, host: vetting.host, why: `it answered ${String(status)}`, retry: true };
    } catch (error) {
      return { sent: false, host: vetting.host, why: controller.signal.aborted ? 'it did not answer in time' : reasonOf(error), retry: true };
    } finally {
      stop();
    }
  }

  async function deliver(ping: Ping): Promise<void> {
    try {
      for (let index = 0; index < PING_TRIES; index += 1) {
        if (index > 0) await sleep(PING_WAITS_MS.at(index - 1) ?? 0);
        const result = await attempt(ping);
        if (result.sent) return;
        if (!result.retry || index === PING_TRIES - 1) {
          give(ping, result.host, result.retry ? `${result.why}, after ${String(PING_TRIES)} tries` : result.why);
          return;
        }
      }
    } catch (error) {
      log(`ping ${ping.jobId} (${ping.event}) failed: ${reasonOf(error)}`);
    }
  }

  return {
    check: async (link) => {
      const vetting = await vet(link, net);
      return 'refusal' in vetting ? vetting.refusal : null;
    },
    // A ping never fails the change that made it: a hand-over that throws is logged and dropped.
    ping: (ping) => {
      try {
        later(() => deliver(ping));
      } catch (error) {
        log(`ping ${ping.jobId} (${ping.event}) was not handed over: ${reasonOf(error)}`);
      }
    },
  };
}
