// The ask page reads its session every 2 s while the tab is visible (the spec: polling, not
// Realtime). A hidden tab rests, and reads at once when it shows again; a read never overlaps the
// one before it; a read that returns false (the session closed) ends the polling.
import { AskSignedOut, untilSignedOut } from '../ask.client';

export const POLL_MS = 2000;

/** What a page says while its reads fail: it keeps what it showed, and tries again. */
export const CANNOT_REACH = 'Cannot reach the server. Trying again every few seconds.';

export type VisibilityDoc = {
  visibilityState: string;
  addEventListener(type: 'visibilitychange', listener: () => void): void;
  removeEventListener(type: 'visibilitychange', listener: () => void): void;
};

/** Starts polling with `tick`, which resolves true to keep going. Returns the stop function. */
export function poll(tick: () => Promise<boolean>, doc: VisibilityDoc, every = POLL_MS): () => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let running = false;
  let stopped = false;

  const later = () => {
    if (!stopped && timer === null) timer = setTimeout(() => void run(), every);
  };
  async function run() {
    timer = null;
    if (stopped || running || doc.visibilityState !== 'visible') return;
    running = true;
    let more = true;
    try {
      more = await tick();
    } catch {
      /* the tick shows its own problem; the next read may work */
    } finally {
      running = false;
    }
    if (more) later();
    else stop();
  }
  function onVisibility() {
    if (doc.visibilityState !== 'visible' || running || stopped) return;
    if (timer !== null) clearTimeout(timer);
    void run();
  }
  function stop() {
    stopped = true;
    if (timer !== null) clearTimeout(timer);
    timer = null;
    doc.removeEventListener('visibilitychange', onVisibility);
  }

  doc.addEventListener('visibilitychange', onVisibility);
  later();
  return stop;
}

/** What a page does with each read of its poll (PRD 1318): `read` through the ask client; `gone` when
 * it reads null (missing, or no longer the person's); `seen` with what it read, answering whether to
 * keep polling; `failed` when it could not read, keeping what it showed; `signedOut` once, after which
 * nothing is asked again. */
export type ReadPoll<T> = {
  read(): Promise<T | null>;
  gone(): void;
  seen(next: T): boolean;
  failed(): void;
  signedOut(): void;
};

/** A page's poll tick over `on`. */
export function readTick<T>(on: ReadPoll<T>): () => Promise<boolean> {
  return untilSignedOut(async () => {
    try {
      const next = await on.read();
      if (!next) {
        on.gone();
        return false;
      }
      return on.seen(next);
    } catch (error) {
      if (error instanceof AskSignedOut) throw error;
      on.failed();
      return true;
    }
  }, () => {
    on.signedOut();
  });
}
