/**
 * The plain `key: value` front matter every kit register reads — an inbox spec, an outbox item and
 * a slice's account alike. One copy, so the three parsers cannot drift apart.
 */

const FRONT_MATTER_LINE = /^([A-Za-z][A-Za-z0-9_-]*):\s*(.*)$/;

/** `message` prefixed with the file it is about, when there is one. */
export function withFile(file: string | null | undefined, message: string): string {
  return file ? `${file}: ${message}` : message;
}

function stripQuotes(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length >= 2) {
    const first = trimmed[0];
    const last = trimmed[trimmed.length - 1];
    if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
      return trimmed.slice(1, -1);
    }
  }
  return trimmed;
}

/**
 * Reads a fenced front-matter block's raw text (between the `---` fences, exclusive) into a plain
 * `{ key: value }` object. Deliberately dumb: one `key: value` per line, quotes stripped, nothing
 * nested. A line that isn't `key: value` is reported rather than silently dropped.
 */
export function parseFrontMatterLines(rawFrontMatter: string): { data: Record<string, string>; errors: string[] } {
  const data: Record<string, string> = {};
  const errors: string[] = [];
  for (const rawLine of rawFrontMatter.split('\n')) {
    const line = rawLine.trim();
    if (!line) continue;
    const match = line.match(FRONT_MATTER_LINE);
    if (!match) {
      errors.push(`front matter line is not "key: value": "${rawLine}"`);
      continue;
    }
    const [, key = '', rawValue = ''] = match;
    data[key] = stripQuotes(rawValue);
  }
  return { data, errors };
}
