// The filer of an Omni Loop bug report (PRD 2980 s4, spec "3. An Omni Loop bug is reported, scrubbed"): a scrubbed
// report (kit/lib/repair/scrub.ts) becomes one issue labelled `bug` on the Omni Loop repository, signed as the Omni App, and
// one row of `omni_bug_reports`; the same fingerprint met again adds a `+1` comment with the kit version and counts it, never a
// second issue. It reaches GitHub and the database only through two ports (`BugIssues`, `BugReportStore`), so no test calls
// either; `./github.ts` and `./store.ts` are their live sides.
//
// A report that `scrub()` refuses never reaches this file: `submitBugReport` (./job.ts) files nothing for it and says why. The
// issue holds the report's fixed fields and nothing else: no workspace, no repository of the customer, no login (never#5,
// never#11, never#12), and says it was written by the Omni App (L-AIACT-1).
import type { PublicReport } from 'omni-loop/kit/lib/repair/scrub.ts';

/** The Omni Loop repository a report is filed on when the App's setting names none. */
export const OMNI_LOOP_REPOSITORY = 'vertuoza/vertuo-omni-loop';

/** The label of every report. */
export const BUG_LABEL = 'bug';

/** A report as the store keeps it: the issue it was filed as, and how often it was met. */
export type FiledReport = { fingerprint: string; repo: string; issue: number; count: number };

/** `omni_bug_reports`, as the App reads and writes it. */
export type BugReportStore = {
  /** The row of a fingerprint, or none. */
  find: (fingerprint: string) => Promise<FiledReport | null>;
  /** A fingerprint filed as an issue, counted once. `false` when a row already holds it (another run filed it first). */
  record: (row: { fingerprint: string; repo: string; issue: number }) => Promise<boolean>;
  /** A repeat counted, in one statement: the row as it now stands, or none. */
  seen: (fingerprint: string) => Promise<FiledReport | null>;
};

/** The issues of the Omni Loop repository, as the Omni App. */
export type BugIssues = {
  /** A new issue, labelled; its number. */
  create: (input: { repo: string; title: string; body: string; labels: readonly string[] }) => Promise<number>;
  /** A comment on an issue. */
  comment: (input: { repo: string; issue: number; body: string }) => Promise<void>;
};

/** What filing did: a new issue, or a repeat on the one already filed. */
export type Filed = { kind: 'filed' | 'repeat'; repo: string; issue: number; fingerprint: string };

/** The line every issue and comment ends with: who wrote it. */
const SIGNATURE = 'Filed by the Omni App from a mission that met this bug. No customer work is in this report.';

/** The issue's title: the command and the message's first words, with the fingerprint's first 8 characters. */
export function issueTitle(report: PublicReport): string {
  const message = report.message.length <= 80 ? report.message : `${report.message.slice(0, 79).trimEnd()}…`;
  return `${report.command}: ${message} [${report.fingerprint.slice(0, 8)}]`;
}

/** The issue's body: the report's fixed fields, one per line, then the signature. */
export function issueBody(report: PublicReport): string {
  return [
    `**Kit version:** ${report.kitVersion}`,
    `**Command:** \`${report.command}\``,
    `**Class:** ${report.class}`,
    `**Fingerprint:** \`${report.fingerprint}\``,
    '',
    report.message,
    '',
    `_${SIGNATURE}_`,
  ].join('\n');
}

/** The `+1` comment of a repeat: the kit version the mission met it on. */
function repeatComment(report: PublicReport): string {
  return `+1 · kit ${report.kitVersion}\n\n_${SIGNATURE}_`;
}

/**
 * Files a report: a repeat of a fingerprint already filed adds a `+1` comment and counts it; a new fingerprint files one issue
 * and records it. A GitHub or database refusal is thrown, and the job ledger tries again. Two runs of one fingerprint never
 * race: the job's lane holds one at a time (./job.ts), and a row another run recorded first turns this one into a repeat.
 */
export async function fileBugReport({
  report,
  repo = OMNI_LOOP_REPOSITORY,
  store,
  issues,
}: {
  report: PublicReport;
  repo?: string;
  store: BugReportStore;
  issues: BugIssues;
}): Promise<Filed> {
  const { fingerprint } = report;
  const known = await store.find(fingerprint);
  if (known) return again(known, report, store, issues);
  const issue = await issues.create({ repo, title: issueTitle(report), body: issueBody(report), labels: [BUG_LABEL] });
  if (await store.record({ fingerprint, repo, issue })) return { kind: 'filed', repo, issue, fingerprint };
  // Another run recorded the fingerprint between our read and our write: this report is a repeat of theirs.
  const raced = await store.find(fingerprint);
  if (!raced) throw new Error('the report row was refused and is not there');
  return again(raced, report, store, issues);
}

/** A repeat: the `+1` comment on the issue it was filed as, then counted. */
async function again(known: FiledReport, report: PublicReport, store: BugReportStore, issues: BugIssues): Promise<Filed> {
  await issues.comment({ repo: known.repo, issue: known.issue, body: repeatComment(report) });
  await store.seen(report.fingerprint);
  return { kind: 'repeat', repo: known.repo, issue: known.issue, fingerprint: report.fingerprint };
}
