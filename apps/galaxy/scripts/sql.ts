// Tiny SQL literal helpers for the generated seed file. Values come from our own demo world.
export const lit = (v: unknown): string => (v === null || v === undefined ? 'null' : `'${String(v).replaceAll("'", "''")}'`);
export const arr = (xs: readonly unknown[]): string => `array[${xs.map(lit).join(', ')}]::text[]`;
export const json = (v: unknown): string => `${lit(JSON.stringify(v))}::jsonb`;
// A workspace's id, looked up by its slug. A slug no workspace has gives null, which every
// workspace_id column refuses: the seed fails loudly instead of filling nothing.
export const workspaceId = (slug: string): string => `(select id from public.workspaces where slug = ${lit(slug)})`;
