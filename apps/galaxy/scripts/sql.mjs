// Tiny SQL literal helpers for the generated seed file. Values come from our own demo world.
export const lit = (v) => (v === null || v === undefined ? 'null' : `'${String(v).replaceAll("'", "''")}'`);
export const arr = (xs) => `array[${xs.map(lit).join(', ')}]::text[]`;
export const json = (v) => `${lit(JSON.stringify(v))}::jsonb`;
