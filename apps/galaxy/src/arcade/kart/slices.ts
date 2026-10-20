// Work done a slice at a time (bug 2152): a circuit's ground takes a second and more to paint and raise,
// far too long to hold the page, which then shows nothing new and lets the music stutter. Such work is a
// generator that stops (yields) after each small step: `drain` runs it to its end at once, `inSlices` a
// slice of time at a time, the page drawing between two slices.

/** Work that stops after each small step, and returns `T` at its end. */
export type Steps<T> = Generator<undefined, T>;

/** How long a slice of work holds the page, in ms: half a frame at 60 frames a second. */
const SLICE = 8;

/** Runs `work` to its end at once and returns what it returns. */
export function drain<T>(work: Steps<T>): T {
  for (;;) {
    const step = work.next();
    if (step.done) return step.value;
  }
}

/**
 * The next task: a message the page posts to itself. The page draws before it when a frame is due, and it
 * comes without the 4 ms a timer set from a timer waits.
 */
export const nextTask = (): Promise<void> => new Promise((resolve) => {
  const { port1, port2 } = new MessageChannel();
  port1.onmessage = () => {
    port1.close();
    resolve();
  };
  port2.postMessage(null);
});

/** Runs `work` to its end, waiting on `pause` each time it has held the page for `slice` ms, and returns what it returns. */
export async function inSlices<T>(work: Steps<T>, pause: () => Promise<void> = nextTask, slice = SLICE, now: () => number = () => performance.now()): Promise<T> {
  let since = now();
  for (;;) {
    const step = work.next();
    if (step.done) return step.value;
    if (now() - since >= slice) {
      await pause();
      since = now();
    }
  }
}
