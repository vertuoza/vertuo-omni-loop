// `law-locked` in the outbox check (PRD 1726): a pull request that changes a locked law stays red until
// a person CODEOWNERS lists for every file that fired it approves it on GitHub.
//
// It runs after `evaluate`, on every pull request the check grades (a feature, fix, knowledge or
// enforce PR), and only ever makes its verdict stricter: an open outbox item, an account, the override
// label or a trailer never clear it, since none of them is read here. The kit says what fired
// (`lockedLawChanges`) and what still holds it (`lawsAwaitingOwners`); this unit reads the two things
// only GitHub knows: CODEOWNERS as the BASE branch holds it (a pull request cannot name its own
// owners), and the reviews. A review counts when it is its author's latest standing review, it
// approves, and it was given on the head commit: a push after the approval asks for it again.
//
// Fail closed: a file no person owns holds its law red, naming it; a team or an e-mail owner is no
// person, since the App cannot read a team's members.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { CODEOWNERS_FILES, ownersOf, readCodeowners } from 'omni-loop/kit/lib/codeowners.ts';
import { createContext } from 'omni-loop/kit/lib/context.ts';
import type { PrNumber } from 'omni-loop/kit/lib/ids.ts';
import { diskSource } from 'omni-loop/kit/lib/knowledge/registers.ts';
import { lawsAwaitingOwners, lockedLawChanges, type LawAwaiting, type LockedLawChange } from 'omni-loop/kit/lib/outbox/decision-coverage.ts';
import { lawOwnerParts } from 'omni-loop/kit/lib/config.ts';
import type { Config } from 'omni-loop/kit/lib/types.ts';
import type { Verdict } from '../evaluate/evaluate.ts';
import { PER_PAGE, paginate } from '../retro/github.ts';
import { snapshot } from '../snapshot/snapshot.ts';
import { ReviewsPageSchema, type GitHubClient, type Repo, type Review } from './github-schema.ts';

/** What `law-locked` found on a pull request: what fired, what still holds, who cleared, and the CODEOWNERS file read. */
export type LawGate = {
  fired: LockedLawChange[];
  awaiting: LawAwaiting[];
  approvedBy: string[];
  codeowners: string | null;
};

/** The review states that say where their author stands; a comment alone leaves it as it was. */
const STANDING: ReadonlySet<string> = new Set(['APPROVED', 'CHANGES_REQUESTED', 'DISMISSED']);

/**
 * The logins whose standing review approves `headSha`: each author's latest review that approves,
 * requests changes or was dismissed, kept when it approves that very commit. `reviews` oldest first.
 */
export function approversOf(reviews: readonly Review[], headSha: string): string[] {
  const standing = new Map<string, Review>();
  for (const review of reviews) {
    const login = review.user?.login;
    if (login !== undefined && STANDING.has(review.state)) standing.set(login, review);
  }
  return [...standing].filter(([, review]) => review.state === 'APPROVED' && review.commit_id === headSha).map(([login]) => login);
}

/** The pull request's reviews, every page, read through {@link approversOf}. */
async function approversAt(
  octokit: GitHubClient,
  { owner, repo, prNumber, headSha }: Repo & { prNumber: PrNumber; headSha: string },
): Promise<string[]> {
  const reviews = await paginate((page) =>
    octokit
      .request('GET /repos/{owner}/{repo}/pulls/{pull_number}/reviews', { owner, repo, pull_number: prNumber, per_page: PER_PAGE, page })
      .then(({ data }) => ReviewsPageSchema.parse(data)),
  );
  return approversOf(reviews, headSha);
}

/**
 * `law-locked` on a pull request: `base` and `head` are the folders `evaluateAt` snapshotted (the base
 * branch's config and knowledge, the head's knowledge). Null when no locked law changed: then neither
 * CODEOWNERS nor the reviews are read. Otherwise CODEOWNERS is snapshotted from `baseSha` into `base`;
 * a file it gives no person falls back to the base config's `laws.owners` (issue 2387).
 */
export async function lawGateAt(
  octokit: GitHubClient,
  {
    owner,
    repo,
    prNumber,
    baseSha,
    headSha,
    config,
    base,
    head,
    changes,
  }: Repo & { prNumber: PrNumber; baseSha: string; headSha: string; config: Config; base: string; head: string; changes: readonly { path: string; status: string }[] },
): Promise<LawGate | null> {
  const fired = lockedLawChanges(changes, { ctx: createContext(head, config), base: diskSource(base) });
  if (fired.length === 0) return null;
  await snapshot(octokit, { owner, repo, ref: baseSha, paths: [...CODEOWNERS_FILES], dest: base });
  const codeowners = readCodeowners((file) => (existsSync(join(base, file)) ? readFileSync(join(base, file), 'utf8') : null));
  const approvers = await approversAt(octokit, { owner, repo, prNumber, headSha });
  const lawOwners = config.laws.owners.map((entry) => lawOwnerParts(entry).owner);
  const held = lawsAwaitingOwners(fired, { ownersOf: (path) => ownersOf(codeowners, path), approvers, lawOwners });
  return { fired, ...held, codeowners: codeowners.file };
}

/** One law still held, in a line of the check's summary. */
function heldLine(held: LawAwaiting, codeowners: string | null): string {
  const files = held.paths.map((path) => `\`${path}\``).join(', ');
  if (held.reason === 'no-codeowner') {
    const where = codeowners === null ? 'no CODEOWNERS file' : `no person in \`${codeowners}\``;
    return `  - ${held.law}: ${where} owns ${files} on the base branch, so nothing can clear it — add its owner there first.`;
  }
  return `  - ${held.law}: waiting for an approving review of the head commit from ${held.owners.join(' or ')}, who own ${files}.`;
}

/**
 * The check's verdict once `law-locked` is read: unchanged when no locked law changed; the same, its
 * approvals said, when every law is cleared; otherwise a failure naming each law still held, whatever
 * `evaluate` concluded (an override's `neutral` included).
 */
export function withLawGate(verdict: Verdict, gate: LawGate | null): Verdict {
  if (gate === null) return verdict;
  const laws = [...new Set(gate.fired.map((one) => one.law))].join(', ');
  if (gate.awaiting.length === 0) {
    const approved = gate.approvedBy.map((login) => `@${login}`).join(', ');
    return { ...verdict, summary: `${verdict.summary}\n\nLocked laws changed (${laws}): approved by their CODEOWNERS, ${approved}.` };
  }
  const heldLaws = gate.awaiting.map((held) => held.law).join(', ');
  const title = `Locked law changed without its CODEOWNER's approval — ${heldLaws}`;
  const summary = [
    `This pull request changes a locked law. Only an approving review on GitHub from a CODEOWNER of each file it changed clears it: no outbox item, label or trailer does.`,
    ...gate.awaiting.map((held) => heldLine(held, gate.codeowners)),
    '',
    verdict.summary,
  ].join('\n');
  return { ...verdict, conclusion: 'failure', title: verdict.conclusion === 'failure' ? `${title}; ${verdict.title}` : title, summary };
}
