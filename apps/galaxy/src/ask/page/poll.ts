// The ask page reads its session every 2 s while the tab is visible (the spec: polling, not
// Realtime). A hidden tab rests, and reads at once when it shows again; a read never overlaps the
// one before it; a read that returns false (the session closed) ends the polling.

export const POLL_MS = 2000;

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
