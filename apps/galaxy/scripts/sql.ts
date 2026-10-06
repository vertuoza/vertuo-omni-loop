// Tiny SQL literal helpers for the generated seed file. Values come from our own demo world.
/** A value a SQL literal can hold: text, a number or a flag, or nothing (`null`). */
type Literal = string | number | boolean | null | undefined;

export const lit = (v: Literal): string => (v === null || v === undefined ? 'null' : `'${String(v).replaceAll("'", "''")}'`);
export const arr = (xs: readonly Literal[]): string => `array[${xs.map(lit).join(', ')}]::text[]`;
export const json = (v: unknown): string => `${lit(JSON.stringify(v))}::jsonb`;
// A workspace's id, looked up by its slug. A slug no workspace has gives null, which every
// workspace_id column refuses: the seed fails loudly instead of filling nothing.
export const workspaceId = (slug: string): string => `(select id from public.workspaces where slug = ${lit(slug)})`;
