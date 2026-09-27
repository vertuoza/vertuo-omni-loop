// What a question cost when it was asked (PRD 144's spec, "What a round records"): the kit sends the
// Claude session's token counts and its model, and this one table prices them. Prices change; they
// change here, and nowhere else. The kit holds no price.
//
// US dollars per million tokens, Anthropic's first-party list prices. A cache write is the 5-minute
// one. The cost is an estimate: the session's tokens up to the question, priced by this table.

export type Tokens = { input: number; output: number; cacheRead: number; cacheWrite: number };
export type Price = { input: number; output: number; cacheRead: number; cacheWrite: number };

const per = (input: number, output: number, cacheRead = input / 10, cacheWrite = input * 1.25): Price =>
  ({ input, output, cacheRead, cacheWrite });

/** Every model this table knows, by its id without a date or a context-window suffix. */
export const PRICES: Readonly<Record<string, Price>> = Object.freeze({
  'claude-fable-5-1': per(10, 50, 0.25),
  'claude-fable-5': per(10, 50),
  'claude-mythos-5-1': per(10, 50, 0.25),
  'claude-opus-5-5': per(4, 20, 0.2),
  'claude-opus-5': per(5, 25),
  'claude-opus-4-8': per(5, 25),
  'claude-opus-4-7': per(5, 25),
  'claude-opus-4-6': per(5, 25),
  'claude-opus-4-5': per(5, 25),
  'claude-opus-4-1': per(15, 75),
  'claude-opus-4': per(15, 75),
  'claude-sonnet-5': per(2, 10),
  'claude-sonnet-4-6': per(3, 15),
  'claude-sonnet-4-5': per(3, 15),
  'claude-sonnet-4': per(3, 15),
  'claude-haiku-4-5': per(1, 5),
  'claude-3-5-haiku': per(0.8, 4),
});

/** A model id as a transcript writes it: the table's id, then maybe a date and a `[1m]`-like suffix. */
const MODEL = /^([a-z0-9-]+?)(?:-\d{8})?(?:\[[^\]]*\])?$/;

/** The price of a model, or null for one the table does not know. */
export function priceOf(model: string | null | undefined): Price | null {
  if (typeof model !== 'string') return null;
  const id = MODEL.exec(model.trim().toLowerCase())?.[1];
  return (id && Object.hasOwn(PRICES, id) ? PRICES[id] : null) ?? null;
}

/** The cost in dollars, to four decimals (the column's scale), or null for an unknown model or no
 * tokens. */
export function costUsd(model: string | null | undefined, tokens: Tokens | null | undefined): number | null {
  const price = priceOf(model);
  if (!price || !tokens) return null;
  const dollars =
    (tokens.input * price.input + tokens.output * price.output + tokens.cacheRead * price.cacheRead + tokens.cacheWrite * price.cacheWrite) /
    1_000_000;
  return Math.round(dollars * 10_000) / 10_000;
}
