// The slice a sub-PR's head branch names, read the same way by every kind that groups pull requests by slice.

/** The slice id a head branch names through `branches.slice` (its topic filled), or `null`. */
export function sliceOf(headRef: string, template: string): string | null {
  const [prefix = '', suffix = ''] = template.split('{slice}');
  if (!headRef.startsWith(prefix) || !headRef.endsWith(suffix)) return null;
  const slice = headRef.slice(prefix.length, headRef.length - suffix.length);
  return slice && !slice.includes('/') ? slice : null;
}
