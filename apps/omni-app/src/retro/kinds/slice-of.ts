// The slice a sub-PR's head branch names, read the same way by every kind that groups pull requests by slice.
import { SliceIdSchema, type SliceId } from 'vertuo-omni-plan/kit/lib/ids.ts';

/**
 * The slice id a head branch names through `branches.slice` (its topic filled), or `null`: a branch
 * whose slice part is not a slice id (`s3`) names none.
 */
export function sliceOf(headRef: string, template: string): SliceId | null {
  const [prefix = '', suffix = ''] = template.split('{slice}');
  if (!headRef.startsWith(prefix) || !headRef.endsWith(suffix)) return null;
  const slice = headRef.slice(prefix.length, headRef.length - suffix.length);
  const read = SliceIdSchema.safeParse(slice);
  return read.success ? read.data : null;
}
