// A token count in words (PRD 3040 s4), written as the supervisor writes it on the mission's wait line (apps/omni-app/src/missions/budget.ts), so a
// mission's page, its fleet's cap and the room's rows read alike. Pure.

const UNITS = [{ size: 1_000_000, mark: 'M' }, { size: 1000, mark: 'k' }] as const;

/** `n` in the largest unit it reaches, to `digits` decimals; a trailing `.0` is kept or dropped as `keep` says. */
function short(n: number, keep: boolean): string {
  const unit = UNITS.find((one) => n >= one.size);
  if (unit === undefined) return String(n);
  const text = (n / unit.size).toFixed(1);
  return `${keep && unit.mark === 'M' ? text : text.replace(/\.0$/, '')}${unit.mark}`;
}

/** What was spent: `950`, `1.1k`, `412k`, `1.3M`, `2.0M`. */
export const spentWords = (n: number): string => short(n, true);

/** A cap: `500`, `1k`, `1.5M`, `2M`. */
export const capWords = (n: number): string => short(n, false);

/** What a number input holds: a whole number above 0, null for an empty field (no cap), `undefined` for anything else. */
export function tokensOf(text: string): number | null | undefined {
  const value = text.trim();
  if (value === '') return null;
  return /^[1-9][0-9]{0,15}$/.test(value) ? Number(value) : undefined;
}
