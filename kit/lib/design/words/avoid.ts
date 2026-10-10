// PRD 1407, s4: the words a product avoids, as the `design` form's `product` section lists them —
// only an explicit list, never a guess from its prose. The list is one line whose label says so,
// `Words we avoid:`, `Words to avoid:`, `Avoided words:` or `Avoid:` (bold, italic or a bullet in
// front are fine), then the words or phrases separated by commas or semicolons, each optionally in
// backticks or quotes; or that label alone on its line, then one bullet per word below it. A
// sentence that merely mentions avoiding something holds no list.

const LABEL = /^(?:words?\s+(?:we|it|they|the\s+product)\s+avoids?|words?\s+to\s+avoid|avoided\s+words?|avoid)$/i;
const BULLET = /^\s*[-*+]\s+(.*)$/;

/** One listed word or phrase, its wrapping backticks, quotes and closing punctuation stripped. */
function cleanTerm(raw: string): string {
  return raw
    .trim()
    .replace(/[.]+$/, '')
    .replace(/^[`"'“‘«]+|[`"'”’»]+$/g, '')
    .trim();
}

const indent = (line: string): number => /^\s*/.exec(line)?.[0].length ?? 0;

/** A line read as `<label>: <rest>`, its markdown emphasis and bullet stripped; null when it is not one. */
function labelled(line: string): { label: string; rest: string } | null {
  const bare = line.replace(/^\s*(?:[-*+]\s+)?/, '').replace(/[*_]/g, '');
  const colon = bare.indexOf(':');
  if (colon === -1) return null;
  return { label: bare.slice(0, colon).trim(), rest: bare.slice(colon + 1).trim() };
}

/** The words a product section lists as avoided, in its order, without duplicates; [] when it lists none. */
export function avoidedWords(product: string): string[] {
  const lines = product.split(/\r?\n/);
  const terms: string[] = [];
  lines.forEach((line, index) => {
    const read = labelled(line);
    if (!read || !LABEL.test(read.label)) return;
    if (read.rest !== '') {
      terms.push(...read.rest.split(/[,;]/).map(cleanTerm));
      return;
    }
    // Under a label that is itself a bullet, only the bullets nested deeper belong to it.
    const floor = BULLET.test(line) ? indent(line) : -1;
    for (const next of lines.slice(index + 1)) {
      const bullet = BULLET.exec(next)?.[1];
      if (bullet === undefined || indent(next) <= floor) break;
      terms.push(cleanTerm(bullet));
    }
  });
  const seen = new Set<string>();
  return terms.filter((term) => {
    const key = term.toLowerCase();
    if (term === '' || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
