// `prdState(n)` (PRD 1299, s4): where a PRD stands, for the gates (`omni prd`, `omni status`,
// `omni next`). It reads the PRD's folder as `whereIs` does. A PRD born in the repository (◇, its spec
// saying no `phase0: server`) reads exactly as today and never calls the server. For a PRD born on the
// server (◆), the approval in force replaces one fact only, "the phase-0 PR merged": its folder in the
// inbox reads `inbox` only when the approval is `approved`; `pending` reads as stage `prd`; `drifted`,
// `unreachable` and `refused` read as that state, which the gates refuse with the reading's lines.
// A shipped folder is shipped either way: everything after the inbox is read from the branch.
//
// The approval is asked through `approval(prd)`: `approvalReader` in production, a fake in tests.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { askClient } from '../ask/client.ts';
import type { Fetch, TokenStore } from '../ask/client.ts';
import { homeTokens } from '../ask/client-tokens.ts';
import { credentialsHost } from '../ask/credentials.ts';
import { parseFrontMatterLines } from '../front-matter.ts';
import type { Layout } from '../layout.ts';
import type { PrdNumber } from '../ids.ts';
import { readApproval, UNREACHABLE_LINE } from './approval.ts';
import type { ApprovalReading } from './approval.ts';

/** Where a PRD was born: in the repository (◇, approved by a phase-0 PR) or on the server (◆). */
export type Birthplace = 'repo' | 'server';

/** A PRD's stage at the gates: today's folder states, `prd` while a ◆ PRD waits for approval, or the
 * approval state a gate refuses. */
export type PrdStage = 'inbox' | 'shipped' | 'prd' | 'drifted' | 'unreachable' | 'refused';

/** Where a PRD stands: its folder, its birthplace, its stage and, for a ◆ PRD in the inbox, the
 * approval reading the stage rests on. */
export type PrdState = { prd: PrdNumber; name: string; dir: string; birthplace: Birthplace; state: PrdStage; approval: ApprovalReading | null };

/** Asks a PRD's approval in force. */
export type ApprovalCall = (prd: PrdNumber) => Promise<ApprovalReading>;

/** An approval reading held before any call, with why: the line stays the unreachable one. */
type HeldReading = ApprovalReading & { why: string };

const FRONT_MATTER = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/;

/** Where PRD `prd` was born, read offline from its spec's `phase0`: `server` only when it says so. */
export function birthplaceOf(ctx: { root: string; layout: Layout }, prd: PrdNumber): Birthplace {
  const spec = ctx.layout.specPath(prd);
  if (!spec || !existsSync(join(ctx.root, spec))) return 'repo';
  const block = FRONT_MATTER.exec(readFileSync(join(ctx.root, spec), 'utf8'));
  if (!block) return 'repo';
  return parseFrontMatterLines(block[1] ?? '').data.phase0 === 'server' ? 'server' : 'repo';
}

/** The stage an approval reading gives a ◆ PRD in the inbox. */
function stageOf(reading: ApprovalReading): PrdStage {
  if (reading.state === 'approved') return 'inbox';
  if (reading.state === 'pending') return 'prd';
  return reading.state;
}

/** Where PRD `prd` stands, or null when no folder holds it. */
export async function prdState(ctx: { root: string; layout: Layout }, prd: PrdNumber, { approval }: { approval: ApprovalCall }): Promise<PrdState | null> {
  const where = ctx.layout.whereIs(prd);
  if (!where) return null;
  const birthplace = birthplaceOf(ctx, prd);
  const place = { prd, name: where.name, dir: where.dir, birthplace };
  if (birthplace === 'repo' || where.state === 'shipped') return { ...place, state: where.state, approval: null };
  const reading = await approval(prd);
  return { ...place, state: stageOf(reading), approval: reading };
}

const held = (why: string): HeldReading =>
  ({ state: 'unreachable', lines: [UNREACHABLE_LINE], url: null, approval: null, drift: [], why });

/** The approval call of `repo` (owner/name) in production: the approval route of `ask.url`, with the
 * terminal's sign-in (`tokens`, else the one kept in `home`). With no Omni page set or no sign-in it
 * calls nothing and holds the PRD, saying why. */
export function approvalReader(
  ctx: { root: string; layout: Layout; config: { ask: { url: string | null } } },
  { repo, tokens, home, fetch, callMs }: { repo: string; tokens?: TokenStore | undefined; home?: string | undefined; fetch?: Fetch | undefined; callMs?: number | undefined },
): ApprovalCall {
  return async (prd) => {
    const askUrl = ctx.config.ask.url;
    if (!askUrl) return held('no Omni page is set here (ask.url)');
    const host = credentialsHost(askUrl);
    const store = tokens ?? homeTokens(home ? { home } : undefined);
    if (!store.read(host)) return held('no sign-in (omni signin)');
    const client = askClient({ baseUrl: askUrl, host, tokens: store, fetch, ...(callMs ? { callMs } : {}) });
    return readApproval(ctx, prd, () => client.readApproval({ repo, prd }));
  };
}
