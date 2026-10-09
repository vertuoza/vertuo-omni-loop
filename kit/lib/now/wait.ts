// The approval wait `omni now` adds to its answer (PRD 1322's spec, §6 "The HUD"), read from the
// waiting file `omni wait approval` keeps in the checkout: `.omni-loop/local/approval-wait/<n>.json`,
// `{ prd, state, line, waiting, at }` (`../approval/wait.ts`).
//
// - **Waiting or held:** the waiting line, else the line itself before anyone was asked, for as long
//   as the file says so.
// - **Approved or voided:** that line as a toast, for 10 seconds from `at`; then the waiting line
//   again after a void, and nothing after an approval.
// - **Signed out, timed out or refused:** nothing: the wait is over and its terminal says why.
//
// The work's PRD comes first; else the wait last written that shows something. A file missing,
// half-written or of another shape is skipped. Nothing here throws, prints or writes.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';
import { LOCAL_DIR } from '../ask/local-state.ts';
import { PrdNumberSchema } from '../ids.ts';
import type { PrdNumber } from '../ids.ts';
import type { NowWait } from './now.ts';
import { attempt } from './tree.ts';

const WAIT_DIR = 'approval-wait';
/** How long the approved or voided line shows as a toast. */
const TOAST_MS = 10_000;

const WaitFileSchema = z.object({
  prd: PrdNumberSchema,
  state: z.enum(['waiting', 'approved', 'voided', 'held', 'signed-out', 'timeout', 'refused']),
  line: z.string().min(1),
  waiting: z.string().min(1).nullable(),
  at: z.iso.datetime({ offset: true }),
});

type WaitFile = z.infer<typeof WaitFileSchema>;

/** What `file` shows at `now` (milliseconds), or `null`. */
function shown(file: WaitFile, now: number): NowWait | null {
  const { prd, state, line, waiting } = file;
  const until = Date.parse(file.at) + TOAST_MS;
  if (state === 'waiting' || state === 'held') return { prd, line: waiting ?? line, toast: false, until: null };
  if ((state === 'approved' || state === 'voided') && now < until) return { prd, line, toast: true, until };
  return state === 'voided' && waiting ? { prd, line: waiting, toast: false, until: null } : null;
}

function readFile(path: string): WaitFile | null {
  const parsed = WaitFileSchema.safeParse(attempt<unknown>(() => JSON.parse(readFileSync(path, 'utf8')), null));
  return parsed.success ? parsed.data : null;
}

/** The approval wait the checkout at `root` shows at `now` (milliseconds): PRD `prd`'s first, else the one last written; `null` when none shows. */
export function readWait(root: string, prd: PrdNumber | null, now: number): NowWait | null {
  const dir = join(root, LOCAL_DIR, WAIT_DIR);
  const names = attempt(() => readdirSync(dir).filter((name) => name.endsWith('.json')), []);
  const files = names.map((name) => readFile(join(dir, name))).filter((file) => file !== null);
  const latest = [...files].sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
  const ordered = [...latest.filter((file) => file.prd === prd), ...latest.filter((file) => file.prd !== prd)];
  for (const file of ordered) {
    const wait = shown(file, now);
    if (wait) return wait;
  }
  return null;
}
