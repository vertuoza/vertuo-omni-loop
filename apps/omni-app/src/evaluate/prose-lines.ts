// A pull request body's lines outside fenced code (issue 1690). A `Part of` claim, a product PRD's
// (`productPrdOf`) or a plan repository PRD's (`planPrdOf`), is a line that starts with it, outside
// code: a fenced block quoting one as an example is no claim. Fences follow CommonMark: three or more
// backticks or tildes, indented by at most three spaces; a backtick fence's info string holds no
// backtick; it closes on a fence of the same character at least as long with nothing after it, or
// runs to the end of the body.

const OPENING = /^ {0,3}(`{3,}(?=[^`]*$)|~{3,})/;

/** The lines of `body` outside fenced code blocks, in order, whatever its line endings. */
export function proseLines(body: string): string[] {
  const out: string[] = [];
  let fence: string | null = null;
  for (const line of body.split(/\r?\n/)) {
    if (fence !== null) {
      const closing = new RegExp(`^ {0,3}${fence[0] === '`' ? '`' : '~'}{${fence.length},}[ \\t]*$`);
      if (closing.test(line)) fence = null;
      continue;
    }
    const opening = OPENING.exec(line);
    if (opening) fence = opening[1] ?? null;
    else out.push(line);
  }
  return out;
}
