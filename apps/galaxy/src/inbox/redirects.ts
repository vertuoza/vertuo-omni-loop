// Where the old addresses of Questions and Waiting land (PRD omni-loop-22, s6): each page keeps its
// address and redirects, so the links agents already posted keep working. The query is always kept;
// an address that picks a chip sets it (`from=shared`, `kind=outbox`), and its pick wins over the
// same name in the query. `/ask/q/<round>` and `/ask/<session>` are not here: they stay where they are.

export type Query = Readonly<Record<string, string | string[] | undefined>>;

const REDIRECTS = {
  '/ask': { to: '/app/inbox', set: {} },
  '/ask/for-me': { to: '/app/inbox', set: { from: 'shared' } },
  '/ask/outbox': { to: '/app/inbox', set: { kind: 'outbox' } },
  '/ask/history': { to: '/app/inbox/done', set: {} },
  '/app/waiting': { to: '/app/inbox/workspace', set: {} },
} as const satisfies Record<string, { to: string; set: Record<string, string> }>;

export type OldAddress = keyof typeof REDIRECTS;

export const OLD_ADDRESSES: readonly OldAddress[] = ['/ask', '/ask/for-me', '/ask/outbox', '/ask/history', '/app/waiting'];

/** Where an old address lands, its query kept. */
export function redirectTarget(old: OldAddress, query: Query): string {
  const { to, set }: { to: string; set: Readonly<Record<string, string>> } = REDIRECTS[old];
  const params = new URLSearchParams(set);
  for (const [name, value] of Object.entries(query)) {
    if (name in set || value === undefined) continue;
    for (const one of Array.isArray(value) ? value : [value]) params.append(name, one);
  }
  const search = params.toString();
  return search === '' ? to : `${to}?${search}`;
}
