// The e2e fallback's line and its result (PRD 2898 s8), shared by the three that read them: the Omni App, which queues
// `/omni:acceptance <prd> --pr <n> --sha <sha>` and reads the job's result from its log tail; the Omni page, which tells
// the App when such a job ended; and the runner, which runs it (./acceptance.ts) and ends its log on the result line,
// `omni-acceptance: <report>` (the acceptance report of kit/lib/ready/report.ts, its `e2e` results only) or
// `omni-acceptance: failed — <why>`. Pure: no process, no file, no network.
import { parsePr, parsePrd, type PrdNumber, type PrNumber } from '../ids.ts';
import { parseAcceptanceReport, type AcceptanceReport } from '../ready/report.ts';

/** The runner line's skill: no plugin skill, the job's process runs it itself. */
export const ACCEPTANCE_SKILL = 'acceptance';

/** What an acceptance line names: the PRD, its feature PR and the commit the scenarios prove. */
export type AcceptanceTarget = { prd: PrdNumber; pr: PrNumber; sha: string };

const LINE = /^\/omni:acceptance ([1-9]\d*) --pr ([1-9]\d*) --sha ([0-9a-f]{40})$/;

/** The line the App queues for `target`. */
export function acceptanceLine({ prd, pr, sha }: AcceptanceTarget): string {
  return `/omni:${ACCEPTANCE_SKILL} ${String(prd)} --pr ${String(pr)} --sha ${sha}`;
}

/** What an acceptance line names; null for any other line, or one out of shape. */
export function parseAcceptanceLine(line: string): AcceptanceTarget | null {
  const match = LINE.exec(line.trim());
  if (!match) return null;
  return { prd: parsePrd(match[1] ?? ''), pr: parsePr(match[2] ?? ''), sha: match[3] ?? '' };
}

/** The mark of the result line the job ends its log on. */
const ACCEPTANCE_MARK = 'omni-acceptance:';

/** What a finished job's log says: the e2e results it proved, or why it proved none. */
export type AcceptanceOutcome = { ok: true; report: AcceptanceReport } | { ok: false; why: string };

/** The result line of a report, on one line. */
export const acceptanceResultLine = (report: AcceptanceReport) => `${ACCEPTANCE_MARK} ${JSON.stringify(report)}`;

/** The result line of a run that proved nothing. */
export const acceptanceFailedLine = (why: string) => `${ACCEPTANCE_MARK} failed — ${why.replace(/\s+/g, ' ').trim()}`;

/** What the last result line of `log` says; null when it holds none, the job not ended or not an acceptance run. */
export function acceptanceOfLog(log: string): AcceptanceOutcome | null {
  const line = log.split('\n').reverse().find((each) => each.includes(ACCEPTANCE_MARK));
  if (line === undefined) return null;
  const said = line.slice(line.indexOf(ACCEPTANCE_MARK) + ACCEPTANCE_MARK.length).trim();
  if (!said.startsWith('{')) return { ok: false, why: said.replace(/^failed — /, '') || 'the run said nothing' };
  const read = parseAcceptanceReport(said);
  return read.ok ? { ok: true, report: read.report } : { ok: false, why: read.why };
}

/** The App's ledger job that runs its ready check (`pr-ready`, apps/omni-app/src/ready-check/job.ts): the Omni page refreshes it
 * when an acceptance job ended, so the App reads the job's result and writes the `acceptance` check run at once. */
export const READY_JOB_KIND = 'pr-ready';

/** The refresh of the `pr-ready` job of the pull request an acceptance line names, as the App's ledger keys it
 * (`<owner/name>#<number>`, lower case), due at once; its payload the check request, never a token (L-GDPR-2). */
export function readyRefreshOf({ installationId, repo, line }: { installationId: number; repo: string; line: string }) {
  const target = parseAcceptanceLine(line);
  const [owner = '', name = ''] = repo.split('/');
  if (target === null || owner === '' || name === '') return null;
  const subject = repo.toLowerCase();
  const payload = { installationId, owner, repo: name, repository: repo, prNumber: target.pr, headSha: target.sha, trigger: 'runner.acceptance' };
  return { kind: READY_JOB_KIND, key: `${subject}#${String(target.pr)}`, subject, payload, delaySeconds: 0 };
}
