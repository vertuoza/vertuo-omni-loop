// An address's query, as a route reads it, and the one value a filter takes from it.

export type Query = Record<string, string | string[] | undefined>;

/** A parameter's first value, trimmed; undefined when absent or blank. */
export const one = (value: string | string[] | undefined) => {
  const first = (Array.isArray(value) ? value[0] : value)?.trim();
  return first ? first : undefined;
};
