// A command whose work awaits nothing, as the async `run` every command meets (PRD 976).

/**
 * `run` as a function returning a promise of its exit code, as an `async` method that awaits
 * nothing did: the code it returns resolves the promise, an error it throws rejects it.
 */
export function synchronous<A extends unknown[]>(run: (...args: A) => number): (...args: A) => Promise<number> {
  return (...args) =>
    new Promise((resolve) => {
      resolve(run(...args));
    });
}
