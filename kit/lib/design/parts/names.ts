// PRD 1559, s2: how a part's name is matched. A mockup tags a part `data-part="<name>"`, and a person
// writes the name as DESIGN.md's `###` heading does or in the markup's own case: `EmptyState`,
// `empty-state` and `Empty state` are one part. Case, spaces, dashes and underscores never tell two
// parts apart.

/** A part's name with its case and every character but a letter or a digit dropped. */
export const partKey = (name: string): string => name.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');

/** Whether `name` is one of `listed`, read as `partKey` reads both. */
export function isListed(listed: readonly string[], name: string): boolean {
  const key = partKey(name);
  return key !== '' && listed.some((part) => partKey(part) === key);
}
