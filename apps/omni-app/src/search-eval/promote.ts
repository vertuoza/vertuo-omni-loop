// The promotion's choice (PRD omni-loop-8 s4, spec "Promotion"), pure: from the search log's grouped searches of the
// last days, each product's most-asked groups of each category, that are not yet in the eval set. No clock, no store.
//
//   a group's category   the category most of its searches carry (a tie goes to the first by name); a group none of
//                        whose searches has a category is in no category and is never promoted
//   most-asked           the most searches in the window; a tie goes to the first by group id, so a day's pick is stable
//   not yet in the set   a group that ever joined the set, a removed question's included, is skipped, so a question
//                        a member removed is never added again; the top is taken first and then the joined are
//                        dropped, so promotion never grows a category's share of the set past `top` groups

/** How many groups of each category are the most-asked (a setting of the job, tuned later). */
export const TOP_GROUPS = 5;
/** How many days of searches count (a setting of the job, tuned later). */
export const WINDOW_DAYS = 30;

/** One logged search of a group, with the category Jev gave it (null when none). */
export type LoggedSearch = { groupId: string; productId: string; workspaceId: string; category: string | null };

/** A group and how often it was asked in the window. */
export type GroupCount = { groupId: string; productId: string; workspaceId: string; category: string; count: number };

/** The groups of the searches, each with its count and its category. */
export function countGroups(searches: readonly LoggedSearch[]): GroupCount[] {
  const byGroup = new Map<string, { productId: string; workspaceId: string; count: number; categories: Map<string, number> }>();
  for (const { groupId, productId, workspaceId, category } of searches) {
    const group = byGroup.get(groupId) ?? { productId, workspaceId, count: 0, categories: new Map<string, number>() };
    group.count += 1;
    if (category !== null) group.categories.set(category, (group.categories.get(category) ?? 0) + 1);
    byGroup.set(groupId, group);
  }
  const counts: GroupCount[] = [];
  for (const [groupId, { productId, workspaceId, count, categories }] of byGroup) {
    const best = [...categories].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];
    if (best) counts.push({ groupId, productId, workspaceId, category: best[0], count });
  }
  return counts;
}

/** The groups to add to the sets: each product's top `top` of each category, minus the groups already `joined`. */
export function pickGroups(counts: readonly GroupCount[], joined: ReadonlySet<string>, top: number = TOP_GROUPS): GroupCount[] {
  const buckets = new Map<string, GroupCount[]>();
  for (const group of counts) {
    const key = `${group.productId}\u0000${group.category}`;
    buckets.set(key, [...(buckets.get(key) ?? []), group]);
  }
  const picked: GroupCount[] = [];
  for (const bucket of buckets.values()) {
    const ranked = [...bucket].sort((a, b) => b.count - a.count || a.groupId.localeCompare(b.groupId));
    picked.push(...ranked.slice(0, top).filter((group) => !joined.has(group.groupId)));
  }
  return picked.sort((a, b) => a.productId.localeCompare(b.productId) || a.category.localeCompare(b.category) || b.count - a.count || a.groupId.localeCompare(b.groupId));
}
