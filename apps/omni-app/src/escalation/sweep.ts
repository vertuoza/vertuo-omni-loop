// `escalation`: the hourly sweep (PRD 1794). For each open pull request of every repository the App is
// installed on that carries the escalation record (`<!-- omni:escalation -->`, ./record.ts), it moves
// each held thing whose next step fell due, posts one ask comment mentioning the people newly asked,
// and rewrites the record. The texts are the kit's (`kit/lib/escalation/comments.ts`), who is asked
// the kit's pure module (`kit/lib/escalation/escalation.ts`).
//
// - **Never twice.** An ask carries `<!-- omni:escalation-ask <thing> <step> -->` per thing; a step
//   some comment on the pull request already announces is never posted again, even when the record
//   was not rewritten after it. The ask is posted before the record, so a failed rewrite only repeats
//   the rewrite.
// - **Only what still holds.** The record lists what the last outbox check run saw held: an answer,
//   an approval that clears a law, or a push re-runs the check, which drops what no longer holds. A
//   closed pull request is never listed. A repository whose base config names no delegate and no
//   leadership asks nobody.
// - **Asking never decides.** It reads and writes comments only: no review, answer, adoption, label,
//   check run or verdict. The gate stays red until a person answers.
//
// It runs as a job of the ledger (./job.ts, PRD omni-loop-3 s2), re-run whole: a pull request GitHub refuses to
// read is logged and swept again the next hour. A call the shared GitHub client refuses unsent (the
// installation's budget below its background floor, or paused: PRD 902) ends the sweep there, the refusal
// thrown, so the job waits and sweeps again; what it already asked is never asked twice.
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { z } from 'zod';
import { decide, escalates, type Decision, type EscalationSettings } from 'omni-loop/kit/lib/escalation/escalation.ts';
import { readAsk, readRecord, renderAsk, renderRecord, type AskedStep, type RecordLine } from 'omni-loop/kit/lib/escalation/comments.ts';
import { parsePr, type PrNumber } from 'omni-loop/kit/lib/ids.ts';
import { refusalIn } from '../approved-check/approved-check.ts';
import type { OctokitFor } from '../octokit-for.ts';
import { listComments, readBaseConfig, type Comment, type GitHubClient } from '../outbox-check/github.ts';
import { PER_PAGE, paginate } from '../retro/github.ts';
import { settingsOf } from './held.ts';

/** The App's own client, signed with its JWT: it lists the installations. */
export type AppClient = () => Promise<GitHubClient> | GitHubClient;

/** A repository an installation holds. */
type Repository = { owner: string; repo: string };

/** What sweeping one pull request did. */
type PullSwept = 'asked' | 'moved' | 'unchanged' | 'none';

/** What sweeping one repository did: the open pull requests read, the asks posted, the pull requests left for the next hour. */
type RepositorySwept = { pulls: number; asked: number; failed: number };

const InstallationsSchema = z.array(z.looseObject({ id: z.number() }));
const RepositoriesSchema = z.looseObject({
  repositories: z.array(z.looseObject({ name: z.string(), owner: z.looseObject({ login: z.string() }) })),
});
const OpenPullsSchema = z.array(z.looseObject({ number: z.number(), base: z.looseObject({ sha: z.string() }) }));

const lower = (login: string): string => login.toLowerCase();

/**
 * The record's lines once every due step is taken, and the decisions an ask announces. A line moves
 * only forward; its newly asked are whom its step asks that the line did not ask yet (a sweep that
 * missed step 1 asks everyone at step 2). A step already announced on the pull request, or one that
 * asks nobody new, moves the line and is announced by no ask.
 */
function moveDue(lines: readonly RecordLine[], settings: EscalationSettings, now: Date, posted: readonly AskedStep[]): { lines: RecordLine[]; due: Decision[] } {
  const decisions = decide(lines.map(({ thing, kind, firstHeld }) => ({ thing, kind, firstHeld, answered: false })), now, settings);
  const due: Decision[] = [];
  const moved = lines.map((line, index) => {
    const decision = decisions[index];
    if (decision === undefined || decision.step <= line.step) return line;
    const already = new Set(line.asked.map(lower));
    const newlyAsked = decision.asked.filter((login) => !already.has(lower(login)));
    const announced = posted.some((one) => one.thing === line.thing && one.step >= decision.step);
    if (!announced && newlyAsked.length > 0) due.push({ ...decision, newlyAsked });
    const { thing, kind, firstHeld, step, asked, nextDue } = decision;
    return { thing, kind, firstHeld, step, asked, nextDue };
  });
  return { lines: moved, due };
}

/** The escalation settings of the base commit `baseSha`, or null when its config is missing or broken. */
async function settingsAt(octokit: GitHubClient, { owner, repo, baseSha }: Repository & { baseSha: string }): Promise<EscalationSettings | null> {
  const dest = mkdtempSync(join(tmpdir(), 'omni-escalation-'));
  try {
    const { config } = await readBaseConfig(octokit, { owner, repo, baseSha, dest });
    return config === null ? null : settingsOf(config);
  } finally {
    rmSync(dest, { recursive: true, force: true });
  }
}

/** The record among `comments` and the held things it lists; null when there is none, or it lists nothing. */
function recordIn(comments: readonly Comment[]): { record: Comment; lines: RecordLine[] } | null {
  for (const comment of comments) {
    const lines = readRecord(comment.body);
    if (lines !== null) return lines.length > 0 ? { record: comment, lines } : null;
  }
  return null;
}

/** Sweeps pull request `prNumber`: one ask for what fell due, then the record rewritten. */
async function sweepPull(
  octokit: GitHubClient,
  { owner, repo, prNumber, now, settings }: Repository & { prNumber: PrNumber; now: Date; settings: () => Promise<EscalationSettings | null> },
): Promise<PullSwept> {
  const comments = await listComments(octokit, { owner, repo, prNumber });
  const found = recordIn(comments);
  if (found === null) return 'none';
  const read = await settings();
  if (read === null || !escalates(read)) return 'none';
  const moved = moveDue(found.lines, read, now, comments.flatMap((comment) => readAsk(comment.body)));
  if (moved.due.length > 0) {
    await octokit.request('POST /repos/{owner}/{repo}/issues/{issue_number}/comments', { owner, repo, issue_number: prNumber, body: renderAsk(moved.due) });
  }
  const body = renderRecord(moved.lines);
  if (body !== found.record.body) {
    await octokit.request('PATCH /repos/{owner}/{repo}/issues/comments/{comment_id}', { owner, repo, comment_id: found.record.id, body });
  }
  if (moved.due.length > 0) return 'asked';
  return body === found.record.body ? 'unchanged' : 'moved';
}

/** Sweeps every open pull request of the repository, its base config read once per base commit, and only for a pull request with a record. */
async function sweepRepository(octokit: GitHubClient, { owner, repo, now, log }: Repository & { now: Date; log: (line: string) => void }): Promise<RepositorySwept> {
  const pulls = await paginate((page) =>
    octokit
      .request('GET /repos/{owner}/{repo}/pulls', { owner, repo, state: 'open', per_page: PER_PAGE, page })
      .then(({ data }) => OpenPullsSchema.parse(data)),
  );
  const configs = new Map<string, Promise<EscalationSettings | null>>();
  const settingsOfBase = (baseSha: string) => () => {
    const known = configs.get(baseSha) ?? settingsAt(octokit, { owner, repo, baseSha });
    configs.set(baseSha, known);
    return known;
  };
  const swept: RepositorySwept = { pulls: pulls.length, asked: 0, failed: 0 };
  for (const pull of pulls) {
    try {
      const outcome = await sweepPull(octokit, { owner, repo, prNumber: parsePr(pull.number), now, settings: settingsOfBase(pull.base.sha) });
      if (outcome === 'asked') swept.asked += 1;
    } catch (error) {
      if (refusalIn(error)) throw error;
      swept.failed += 1;
      log(`escalation sweep of ${owner}/${repo}#${String(pull.number)} waits for the next hour: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  return swept;
}

async function installationsOf(app: GitHubClient): Promise<number[]> {
  const installations = await paginate((page) =>
    app.request('GET /app/installations', { per_page: PER_PAGE, page }).then(({ data }) => InstallationsSchema.parse(data)),
  );
  return installations.map(({ id }) => id);
}

async function repositoriesOf(octokit: GitHubClient): Promise<Repository[]> {
  const repositories = await paginate((page) =>
    octokit.request('GET /installation/repositories', { per_page: PER_PAGE, page }).then(({ data }) => RepositoriesSchema.parse(data).repositories),
  );
  return repositories.map(({ name, owner }) => ({ owner: owner.login, repo: name }));
}

/** What one sweep did: the repositories swept, the open pull requests read, the asks posted, the pull requests left for the next hour. */
export type Swept = RepositorySwept & { repositories: number };

/** Sweeps every repository of every installation of the App, at `now`. */
export async function sweepAll({ app, octokitFor, now, log }: { app: GitHubClient; octokitFor: OctokitFor<GitHubClient>; now: Date; log: (line: string) => void }): Promise<Swept> {
  const total: Swept = { repositories: 0, pulls: 0, asked: 0, failed: 0 };
  for (const installation of await installationsOf(app)) {
    const octokit = await octokitFor(installation);
    for (const { owner, repo } of await repositoriesOf(octokit)) {
      const swept = await sweepRepository(octokit, { owner, repo, now, log });
      total.repositories += 1;
      total.pulls += swept.pulls;
      total.asked += swept.asked;
      total.failed += swept.failed;
    }
  }
  return total;
}

