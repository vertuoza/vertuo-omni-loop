// The escalation record on a pull request (PRD 1794): after each outbox check run, one comment marked
// `<!-- omni:escalation -->`, edited in place, one line per thing that still waits on a person. Its
// text is the kit's (`kit/lib/escalation/comments.ts`); this unit only keeps it current.
//
// - A thing seen held for the first time gets this run's time, at step 0, asking nobody new.
// - A thing already in the record keeps its line as it is: its first-held time, and the step the
//   hourly sweep last moved it to. Only the sweep moves a step, so the record never runs ahead of the
//   ask comments.
// - A thing no longer held is dropped. Nothing held and no record yet: no comment.
// - A repository with no delegate and no `laws.leadership` escalates nothing: no comment, no request.
//
// It never decides: the check's verdict is completed before it runs, and nothing here approves,
// adopts, answers, labels or sets a verdict. The record mentions nobody: an edited comment notifies
// nobody, so asking is the sweep's own new comment.
import { decide, escalates, type EscalationSettings } from 'omni-loop/kit/lib/escalation/escalation.ts';
import { readRecord, renderRecord, type RecordLine } from 'omni-loop/kit/lib/escalation/comments.ts';
import type { PrNumber } from 'omni-loop/kit/lib/ids.ts';
import { listComments, type GitHubClient } from '../outbox-check/github.ts';
import type { Held, HeldNow } from './held.ts';

/** How the record was left. */
export type RecordKept = 'created' | 'updated' | 'unchanged' | 'none';

/** An instant as the record writes it: ISO 8601 to the second. */
const instant = (date: Date): string => date.toISOString().replace(/\.\d{3}Z$/, 'Z');

/** The record's line for a thing first seen held now. */
function freshLine(one: Held, now: Date, settings: EscalationSettings): RecordLine {
  const [decision] = decide([{ ...one, firstHeld: instant(now), answered: false }], now, settings);
  if (decision === undefined) throw new Error('escalation: decide returned no line for a held thing');
  const { thing, kind, firstHeld, step, asked, nextDue } = decision;
  return { thing, kind, firstHeld, step, asked, nextDue };
}

/** The record's lines for what holds now: a thing already recorded keeps its line, a new one starts now. */
export function recordLines(previous: readonly RecordLine[], { settings, held }: HeldNow, now: Date): RecordLine[] {
  return held.map((one) => previous.find((line) => line.thing === one.thing && line.kind === one.kind) ?? freshLine(one, now, settings));
}

/** Keeps the escalation record on pull request `prNumber` current with what holds now. */
export async function keepRecord(
  octokit: GitHubClient,
  { owner, repo, prNumber, now, ...holding }: HeldNow & { owner: string; repo: string; prNumber: PrNumber; now: Date },
): Promise<RecordKept> {
  if (!escalates(holding.settings)) return 'none';
  const comments = await listComments(octokit, { owner, repo, prNumber });
  const existing = comments.find((comment) => readRecord(comment.body) !== null);
  if (existing === undefined && holding.held.length === 0) return 'none';
  const body = renderRecord(recordLines(existing === undefined ? [] : (readRecord(existing.body) ?? []), holding, now));
  if (existing === undefined) {
    await octokit.request('POST /repos/{owner}/{repo}/issues/{issue_number}/comments', { owner, repo, issue_number: prNumber, body });
    return 'created';
  }
  if (existing.body === body) return 'unchanged';
  await octokit.request('PATCH /repos/{owner}/{repo}/issues/comments/{comment_id}', { owner, repo, comment_id: existing.id, body });
  return 'updated';
}
