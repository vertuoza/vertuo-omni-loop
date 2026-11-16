// Issue 2968: independent reads run side by side, at most `limit` at once, their results kept in the
// order of their items. It fails as running them one after another would: once an item fails, no later
// item starts; the ones already started finish, and the error of the first item that failed, in item
// order, is thrown.

/** `each(item)` for every item, at most `limit` at once, the results in item order. */
export async function sideBySide<T, R>(items: readonly T[], limit: number, each: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array<R>(items.length);
  const failures = new Map<number, unknown>();
  // One queue the workers share: each takes the next item in order; once one failed, none starts another.
  const queue = items.entries();
  const worker = async (): Promise<void> => {
    for (const [index, item] of queue) {
      if (failures.size > 0) return;
      try {
        results[index] = await each(item);
      } catch (error) {
        failures.set(index, error);
        return;
      }
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, worker));
  if (failures.size > 0) throw failures.get(Math.min(...failures.keys()));
  return results;
}
