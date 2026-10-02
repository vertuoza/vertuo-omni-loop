/**
 * What an `async` method that awaits nothing gave (PRD 976): the value `run` returns, as a promise, and
 * a rejection, never a throw, when `run` throws. The fake stores answer through it, so a refused call
 * reaches its caller exactly as before.
 */
export function settled<T>(run: () => T): Promise<T> {
  return new Promise((resolve) => {
    resolve(run());
  });
}
