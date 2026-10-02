import 'server-only';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { loadConfig } from 'vertuo-omni-plan/kit/lib/config.ts';
import { createContext } from 'vertuo-omni-plan/kit/lib/context.ts';
import { parsePlanSlices } from 'vertuo-omni-plan/kit/lib/inbox/territory.ts';
import { parseFolderName } from 'vertuo-omni-plan/kit/lib/layout.ts';
import { ADOPTED_VERDICT, parseSettledEntries } from 'vertuo-omni-plan/kit/lib/outbox/settle.ts';
import { firstPart } from 'vertuo-omni-plan/kit/lib/narrow.ts';
import { checkoutRoot } from '../data/load-knowledge';

// HOME's high scores (PRD 261): what the loop has shipped building itself, counted from the shipped
// delivery folder of the checkout the page is built from, through the kit's own parsers — no
// Supabase, no GitHub call. A counter whose files cannot all be read shows `—`, never a guess; the
// other counters still count.

/** What a counter shows when it cannot be read. */
export const NO_SCORE = '—';

export type Score = number | typeof NO_SCORE;

export type HighScores = {
  /** The PRD folders under `shipped/`. */
  prdsShipped: Score;
  /** The rows of every shipped `plan.md`'s slice table. */
  slicesMerged: Score;
  /** The entries of every shipped `outbox/settled.md` whose (latest) verdict is `adopted`. */
  decisionsAdopted: Score;
};

const UNREAD: HighScores = { prdsShipped: NO_SCORE, slicesMerged: NO_SCORE, decisionsAdopted: NO_SCORE };

const firstLine = (err: unknown) => (err instanceof Error ? firstPart(err.message, '\n') : String(err));

/** The high scores of the checkout at or above `cwd`; one line logged per counter it cannot read. */
export function countHighScores({ cwd = process.cwd(), log = console.error }: { cwd?: string; log?: (line: string) => void } = {}): HighScores {
  const unread = (why: string) => { log(`high scores: out of reach — ${why}`); return UNREAD; };
  const root = checkoutRoot(cwd);
  if (root === null) return unread(`no Omni Loop config in ${cwd} or above`);

  let shippedDir: string;
  let markers: Parameters<typeof parseSettledEntries>[1];
  try {
    const ctx = createContext(root, loadConfig(root));
    shippedDir = ctx.layout.dirs.shipped;
    markers = ctx.markers;
  } catch (err) {
    return unread(firstLine(err));
  }

  // A path known only at build time: left out of the trace, as load-knowledge does.
  const shipped = join(/*turbopackIgnore: true*/ root, shippedDir);
  if (!existsSync(/*turbopackIgnore: true*/ shipped)) return unread(`${shippedDir} is missing in ${root}`);

  const prds = readdirSync(/*turbopackIgnore: true*/ shipped, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && parseFolderName(entry.name) !== null)
    .map((entry) => entry.name);

  /** The sum of `count` over every shipped PRD, or `—` when any one of them cannot be read. */
  const sum = (counter: string, count: (folder: string) => number): Score => {
    let total = 0;
    for (const name of prds) {
      try {
        total += count(join(/*turbopackIgnore: true*/ shipped, name));
      } catch (err) {
        log(`high scores: ${counter} out of reach — ${name}: ${firstLine(err)}`);
        return NO_SCORE;
      }
    }
    return total;
  };

  return {
    prdsShipped: prds.length,
    slicesMerged: sum('slices merged', (folder) => parsePlanSlices(readFileSync(join(folder, 'plan.md'), 'utf8')).length),
    // A PRD that raised no decision ships with no outbox (PRD 373): it adopted none.
    decisionsAdopted: sum('decisions adopted', (folder) => {
      const file = join(folder, 'outbox', 'settled.md');
      if (!existsSync(/*turbopackIgnore: true*/ join(folder, 'outbox'))) return 0;
      return parseSettledEntries(readFileSync(file, 'utf8'), markers).filter((entry) => entry.verdict === ADOPTED_VERDICT).length;
    }),
  };
}
