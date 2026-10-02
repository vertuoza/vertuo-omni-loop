// Churn's line ranges, followed through the hunks (PRD 72, "The facts, and what makes a finding"). Pure.
//
// A patch is read as its change blocks: each a run of removed and added lines with no context line
// between them, as `[oldStart, oldCount, newStart, newCount]`. Only these four numbers are kept of a
// patch, never its text, so a whole delivery's commits fit in one step's output.
//
// The lines written during the delivery are followed commit by commit: `[line, commits]`, the commits
// that wrote the line, oldest first. A block that replaces lines passes their commits on to the lines
// that replace them, and adds its own; a line it only inserts carries its own commit alone; a line
// below a block moves by what the block added minus what it removed. A range rewritten again and
// again is then a run of consecutive lines each written in enough commits.

export type Block = [oldStart: number, oldCount: number, newStart: number, newCount: number];
export type Line = [line: number, commits: string[]];
export type Range = { from: number; to: number; commits: string[] };

const HUNK = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/;

/**
 * The change blocks of one unified diff patch, in order.
 */
export function changeBlocks(patch: string): Block[] {
  const blocks: Block[] = [];
  let inHunk = false;
  let oldLine = 0;
  let newLine = 0;
  let open: { oldStart: number; oldCount: number; newStart: number; newCount: number } | null = null;
  const close = () => {
    if (open) blocks.push([open.oldStart, open.oldCount, open.newStart, open.newCount]);
    open = null;
  };

  for (const line of patch.split('\n')) {
    const header = HUNK.exec(line);
    if (header) {
      close();
      // A count left out is one line.
      const [oldStart = 1, oldCount = 1, newStart = 1, newCount = 1] = header.slice(1).map((n) => (n === undefined ? 1 : Number(n)));
      // A side of zero lines names the line before the hunk; its first line is the next one.
      oldLine = oldCount === 0 ? oldStart + 1 : oldStart;
      newLine = newCount === 0 ? newStart + 1 : newStart;
      inHunk = true;
      continue;
    }
    if (!inHunk) continue;
    const mark = line[0];
    if (mark === '-' || mark === '+') {
      open ??= { oldStart: oldLine, oldCount: 0, newStart: newLine, newCount: 0 };
      if (mark === '-') {
        open.oldCount += 1;
        oldLine += 1;
      } else {
        open.newCount += 1;
        newLine += 1;
      }
    } else if (mark !== '\\') {
      close();
      oldLine += 1;
      newLine += 1;
    }
  }
  close();
  return blocks;
}

/**
 * The lines written so far, after one more commit's blocks on the same file.
 * `lines` in line order, `blocks` in order as `changeBlocks` reads them; the lines come back in line order.
 */
export function followLines(lines: readonly Line[], blocks: readonly Block[], commit: string): Line[] {
  const next = new Map<number, string[]>();
  const replaced: string[][] = blocks.map(() => []);
  let index = 0;
  let shift = 0;
  for (const [line, commits] of lines) {
    let block = blocks[index];
    while (block !== undefined && block[0] + block[1] <= line) {
      shift += block[3] - block[1];
      index += 1;
      block = blocks[index];
    }
    if (block !== undefined && block[0] <= line) replaced[index]?.push(...commits);
    else put(next, line + shift, commits);
  }
  blocks.forEach(([, , newStart, newCount], i) => {
    const commits = unique([...(replaced[i] ?? []), commit]);
    for (let line = newStart; line < newStart + newCount; line += 1) put(next, line, commits);
  });
  return [...next.entries()].sort((a, b) => a[0] - b[0]);
}

/**
 * The runs of consecutive lines each written in at least `minCommits` commits: `{ from, to, commits }`,
 * `commits` every commit that wrote a line of the run, in the order first met.
 * `lines` in line order.
 */
export function rewrittenRanges(lines: readonly Line[], minCommits: number): Range[] {
  const ranges: Range[] = [];
  let current: Range | null = null;
  for (const [line, commits] of lines) {
    if (commits.length < minCommits) {
      current = null;
      continue;
    }
    if (current && line === current.to + 1) {
      current.to = line;
      current.commits = unique([...current.commits, ...commits]);
    } else {
      current = { from: line, to: line, commits: [...commits] };
      ranges.push(current);
    }
  }
  return ranges;
}

/** Two blocks that disagree with the lines followed so far can land on one line: it keeps both histories. */
function put(map: Map<number, string[]>, line: number, commits: string[]): void {
  const known = map.get(line);
  map.set(line, known !== undefined ? unique([...known, ...commits]) : commits);
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values)];
}
