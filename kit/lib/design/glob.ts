// PRD 1369: the globs `design.paths` holds, matched against repository paths (forward slashes, no
// leading `./`). `*` and `?` stay within one segment, `**` spans any number of segments (none
// included), `{a,b}` is either. A pattern ending in `/`, or with no wildcard at all, names a folder or
// a file: it matches that path and everything under it. Every other character is literal.

const WILDCARD = /[*?{]/;

/** What each wildcard stands for; any other token is a literal character, escaped. */
const WILDCARDS: Readonly<Record<string, string>> = Object.freeze({ '**/': '(?:.*/)?', '**': '.*', '*': '[^/]*', '?': '[^/]' });
const TOKEN = /\*\*\/|\*\*|\*|\?|\{([^{}]*)\}|[\s\S]/g;

/** A pattern as a regular expression source. */
function source(pattern: string): string {
  return pattern.replace(TOKEN, (token: string, alternatives: string | undefined) => {
    if (alternatives !== undefined) return `(?:${alternatives.split(',').map(source).join('|')})`;
    return WILDCARDS[token] ?? token.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  });
}

/** Whether `path` matches the glob `pattern`. */
export function matchesGlob(pattern: string, path: string): boolean {
  const glob = pattern.startsWith('./') ? pattern.slice(2) : pattern;
  if (glob.endsWith('/') || !WILDCARD.test(glob)) {
    const folder = glob.replace(/\/+$/, '');
    return path === folder || path.startsWith(`${folder}/`);
  }
  return new RegExp(`^${source(glob)}$`).test(path);
}
