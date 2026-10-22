// What each read of /prd and /prd/<id> cost, by name (PRD 2401 s1): a page times its reads with `time`
// and says them in the page itself, as a hidden `<template id="server-timing">` holding the
// `Server-Timing` value (`viewer;dur=3.2, dossier_list;dur=41.7`). A page of the App Router cannot set
// a response header once it has begun to stream, and a header is sent before its first byte, so the
// value rides at the end of the document, once every read it names has settled. scripts/perf-prd.ts
// reads it back. Nothing here is a secret: only a read's name and its milliseconds.

/** One read's name and how long it took, in milliseconds. */
export type Timing = { name: string; ms: number };

/** The reads of one request: `time` runs one under its name, `entries` lists those that settled. */
export interface Timings {
  /** Awaits `read`, recording how long it took under `name`, whether it resolved or failed. */
  time<T>(name: string, read: PromiseLike<T> | (() => PromiseLike<T>)): Promise<T>;
  entries(): readonly Timing[];
}

/** A request's timings, clocked by `now` (milliseconds; the performance clock by default). */
export function createTimings(now: () => number = () => performance.now()): Timings {
  const entries: Timing[] = [];
  return {
    async time<T>(name: string, read: PromiseLike<T> | (() => PromiseLike<T>)): Promise<T> {
      const start = now();
      try {
        return await (typeof read === 'function' ? read() : read);
      } finally {
        entries.push({ name, ms: now() - start });
      }
    },
    entries: () => entries,
  };
}

/** The `Server-Timing` value of `entries`: `name;dur=<ms>` for each, a name made of token characters only. */
export function serverTiming(entries: readonly Timing[]): string {
  return entries.map(({ name, ms }) => `${name.replace(/[^A-Za-z0-9_-]/g, '_')};dur=${(Math.round(ms * 10) / 10).toString()}`).join(', ');
}

/** The reads named in a `Server-Timing` value, as they were written. */
export function parseServerTiming(value: string): Timing[] {
  return value.split(',').flatMap((part) => {
    const [name, ...params] = part.trim().split(';');
    const dur = params.map((p) => /^\s*dur=([0-9.]+)\s*$/.exec(p)?.[1]).find((d) => d !== undefined);
    return name && dur !== undefined && Number.isFinite(Number(dur)) ? [{ name, ms: Number(dur) }] : [];
  });
}

/** The timings in a rendered page, or none when it carries no `server-timing` template. */
export function timingsInPage(html: string): Timing[] {
  const found = /<template id="server-timing" data-value="([^"]*)"/.exec(html);
  return found?.[1] ? parseServerTiming(found[1]) : [];
}
