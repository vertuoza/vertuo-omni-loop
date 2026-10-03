// Copies of a row a strict schema (PRD 1030) must refuse, for its tests: the row with one column gone,
// one column of the wrong type, and a null where the column allows none. Each schema's test parses the
// module's own fixture, then refuses every copy this makes of it.

type Row = Record<string, unknown>;

/** What to break: the column to drop, a column and a value of the wrong type for it, and a column that
 * may not be null. */
export type Breaks = { missing: string; wrongType: [string, unknown]; notNull: string };

/** The three broken copies of `row`, each named by how it is broken. */
export function brokenRows(row: object, { missing, wrongType: [column, value], notNull }: Breaks): [string, Row][] {
  const without = Object.fromEntries(Object.entries(row).filter(([key]) => key !== missing));
  return [
    [`without ${missing}`, without],
    [`${column} of the wrong type`, { ...row, [column]: value }],
    [`${notNull} null`, { ...row, [notNull]: null }],
  ];
}
