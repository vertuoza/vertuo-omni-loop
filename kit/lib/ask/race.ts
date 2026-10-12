// Two ways back for one sign-in, raced (PRD 1660): the loopback flow listens on 127.0.0.1 and polls a
// device request at once, so a browser that did not open, or opened on another machine, still signs
// the terminal in. Whichever comes back first wins, and the other is closed (the listener stopped, the
// polling ended) before the race gives its result.
//
// A contender that fails drops out and the race keeps waiting on the others: a device request the
// page cannot be reached for never stops a loopback that is about to come back. Once every contender
// has failed, the race fails with the last failure, the one that ended the wait.

/** One way back: what it brings, and how to stop it waiting. */
export type Contender<T> = {
  result: Promise<T>;
  close(): Promise<void>;
};

/** What the first contender to come back brings, the others still waiting closed; the last failure when all fail. */
export function firstOf<T>(contenders: readonly Contender<T>[]): Promise<T> {
  if (contenders.length === 0) return Promise.reject(new Error('a race needs at least one contender: no contender given'));
  return new Promise<T>((resolve, reject) => {
    let won = false;
    const failed = new Set<Contender<T>>();
    contenders.forEach((contender) => {
      contender.result.then(
        async (value) => {
          if (won) return;
          won = true;
          await Promise.all(contenders.filter((other) => other !== contender && !failed.has(other)).map(async (other) => other.close()));
          resolve(value);
        },
        (error: unknown) => {
          if (won) return;
          failed.add(contender);
          if (failed.size === contenders.length) reject(error);
        },
      ).catch(reject);
    });
  });
}
