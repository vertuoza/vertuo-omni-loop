// Where a question goes (PRD omni-loop-7 s3, spec "The group"): near-identical questions share a group, found by
// the vectors meaning search already computes, with no model call. A question joins the group of its product
// whose first question is within SIMILARITY of it by cosine, else starts a group of its own.

/** The cosine at or above which a question joins a group (spec: 0.92, a setting of the job, tuned once real data shows it). */
export const SIMILARITY = 0.92;

/** The product's nearest group to a question's vector and its cosine, as `mcp_search_group_nearest()` answers it. */
export type Nearest = { groupId: string; cosine: number };

/** Where the question goes: into an existing group, or a group of its own. */
export type Placement = { kind: 'join'; groupId: string } | { kind: 'start' };

/** `nearest` joined at `threshold` or above; below it, or with no group yet, a new group starts. */
export function place(nearest: Nearest | null, threshold: number = SIMILARITY): Placement {
  return nearest !== null && nearest.cosine >= threshold ? { kind: 'join', groupId: nearest.groupId } : { kind: 'start' };
}

/** The cosine of two vectors of the same length; 0 when either has no length. */
export function cosine(a: readonly number[], b: readonly number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i += 1) {
    const x = a[i] ?? 0;
    const y = b[i] ?? 0;
    dot += x * y;
    na += x * x;
    nb += y * y;
  }
  return na === 0 || nb === 0 ? 0 : dot / Math.sqrt(na * nb);
}
