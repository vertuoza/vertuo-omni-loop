import 'server-only';
import { lookup } from 'node:dns/promises';
import { request as httpsRequest, type RequestOptions } from 'node:https';
import { isIP } from 'node:net';
import { after } from 'next/server';
import { log } from 'omni-loop/kit/lib/log/log.ts';
import type { Notifier } from '../runners/runners.contract';
import { notifier, type NotifyDeps, type PingRequest } from './notify';

// The real network of the ping a key-sent job makes (PRD 2425 s8): what `notify.ts` takes as `NotifyDeps`. The rules
// (which link may be pinged, the tries, the waits) are `notify.ts`'s and are tested there over a fake network; this file
// is only the part that touches the network, kept as thin as it can be.
//
// The post is pinned to the address `notify.ts` has just checked: the connection goes to that address and not to a second
// lookup of the name, while the TLS server name and the Host header stay the link's own, so the certificate is still
// checked against the name the caller gave. Node's https follows no redirect, and none is added here: a link that answers
// 3xx has answered, and `notify.ts` counts it a failed try. The response is dropped once its status is read, and a failure
// carries only an error code, never the link.

/** The options of one post, pinned to `address`: the link's port, path and host name, and nothing of its own to follow. */
export function pinnedOptions({ url, address, body, signal }: PingRequest): RequestOptions {
  const link = new URL(url);
  const name = link.hostname.replace(/^\[|\]$/g, '');
  return {
    method: 'POST',
    host: address,
    port: link.port === '' ? 443 : Number(link.port),
    path: `${link.pathname}${link.search}`,
    // A name is the certificate's to check; an address has no server name (RFC 6066) and is checked as itself.
    ...(isIP(name) === 0 ? { servername: name } : {}),
    headers: { host: link.host, 'content-type': 'application/json', 'content-length': Buffer.byteLength(body) },
    // A fresh connection each time: a pooled one would be to whichever address a former link was pinned to.
    agent: false,
    signal,
  };
}

/** What a failed post says of itself: the error's code (`ECONNREFUSED`), else its name, never its message. */
const codeOf = (error: Error & { code?: unknown }): string => (typeof error.code === 'string' ? error.code : error.name);

/** The part of node's https.request this file uses, so a test can stand in for it. */
export type Send = (
  options: RequestOptions,
  onResponse: (response: { statusCode?: number | undefined; destroy: () => unknown }) => void,
) => { on: (event: 'error', handler: (error: Error) => void) => unknown; end: (body: string) => unknown; destroy: () => unknown };

/** One post to the pinned address: the response's status code, the response dropped once it is read. */
export function pinnedPost(request: PingRequest, send: Send = httpsRequest): Promise<number> {
  return new Promise<number>((resolve, reject) => {
    const posted = send(pinnedOptions(request), (response) => {
      resolve(response.statusCode ?? 0);
      response.destroy();
      posted.destroy();
    });
    posted.on('error', (error: Error) => { reject(new Error(codeOf(error))); });
    posted.end(request.body);
  });
}

/** The part of node's dns lookup this file uses, so a test can stand in for it. */
export type Find = (host: string, options: { all: true; verbatim: true }) => Promise<{ address: string }[]>;

/** Every address a name resolves to, in the order the resolver gave them. */
export async function addressesOf(host: string, find: Find = lookup): Promise<string[]> {
  const found = await find(host, { all: true, verbatim: true });
  return found.map(({ address }) => address);
}

/** Calls `fire` after `ms` unless the returned function is called first. */
export function timerOf(ms: number, fire: () => void): () => void {
  const id = setTimeout(fire, ms);
  return () => { clearTimeout(id); };
}

/** The notifier over the real network: its pings run once the response has gone (Next's after()). */
export function liveNotifier(): Notifier {
  const deps: NotifyDeps = {
    net: { resolve: (host) => addressesOf(host), fetch: (request) => pinnedPost(request) },
    sleep: (ms) => new Promise<void>((resolve) => { setTimeout(resolve, ms); }),
    timer: timerOf,
    log: (message) => { log.warn({ event: 'notify', outcome: 'failed', message }); },
    later: (task) => { after(task); },
  };
  return notifier(deps);
}
