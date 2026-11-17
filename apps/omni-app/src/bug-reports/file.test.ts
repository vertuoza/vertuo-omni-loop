// The filer of an Omni Loop bug report (PRD 2980 s4, AC-5 and AC-6) on a fake GitHub and a fake store: no test calls GitHub
// or the database. One issue per fingerprint, a `+1` on a repeat, nothing filed on a refused scrub, a refusal thrown for the
// ledger to retry.
import { scrub } from 'omni-loop/kit/lib/repair/scrub.ts';
import { describe, expect, it } from 'vitest';
import type { ClaimedJob, NewJob } from '../jobs/ledger.ts';
import { BUG_LABEL, fileBugReport, issueBody, issueTitle, OMNI_LOOP_REPOSITORY, type BugIssues, type BugReportStore, type FiledReport } from './file.ts';
import { BUG_REPORT_KIND, BUG_REPORT_LANE, bugReportHandler, submitBugReport } from './job.ts';

const FINGERPRINT = 'c'.repeat(64);
const unknownToken = ['Zx9Q', 'w2Lm', '4Np6', 'Rt8V', 'b0Cd', '3Fg5'].join('');

const input = (over: Record<string, unknown> = {}) => ({
  kitVersion: '0.0.659',
  command: '/omni:yolo',
  class: 'omni-loop' as const,
  message: 'omni next crashed',
  fingerprint: FINGERPRINT,
  ...over,
});

const report = (over: Record<string, unknown> = {}) => {
  const scrubbed = scrub(input(over));
  if (!scrubbed.ok) throw new Error(scrubbed.reason);
  return scrubbed.report;
};

/** The database in memory, and the issues of a fake GitHub: what was created and commented, in order. */
function fakes({ refuse = false }: { refuse?: boolean } = {}) {
  const rows = new Map<string, FiledReport>();
  const created: { repo: string; title: string; body: string; labels: readonly string[] }[] = [];
  const comments: { repo: string; issue: number; body: string }[] = [];
  const store: BugReportStore = {
    find: (fingerprint) => Promise.resolve(rows.get(fingerprint) ?? null),
    record: (row) => {
      if (rows.has(row.fingerprint)) return Promise.resolve(false);
      rows.set(row.fingerprint, { ...row, count: 1 });
      return Promise.resolve(true);
    },
    seen: (fingerprint) => {
      const row = rows.get(fingerprint);
      if (!row) return Promise.resolve(null);
      const next = { ...row, count: row.count + 1 };
      rows.set(fingerprint, next);
      return Promise.resolve(next);
    },
  };
  const issues: BugIssues = {
    create: (issue) => {
      if (refuse) return Promise.reject(new Error('GitHub refused: 502'));
      created.push(issue);
      return Promise.resolve(40 + created.length);
    },
    comment: (comment) => {
      if (refuse) return Promise.reject(new Error('GitHub refused: 502'));
      comments.push(comment);
      return Promise.resolve();
    },
  };
  return { store, issues, rows, created, comments };
}

describe('fileBugReport', () => {
  it('files one issue labelled bug on the Omni Loop repository and records it', async () => {
    const db = fakes();
    const filed = await fileBugReport({ report: report(), store: db.store, issues: db.issues });
    expect(filed).toEqual({ kind: 'filed', repo: OMNI_LOOP_REPOSITORY, issue: 41, fingerprint: FINGERPRINT });
    expect(db.created).toHaveLength(1);
    expect(db.created[0]).toMatchObject({ repo: 'vertuoza/vertuo-omni-loop', labels: [BUG_LABEL] });
    expect(db.rows.get(FINGERPRINT)).toEqual({ fingerprint: FINGERPRINT, repo: OMNI_LOOP_REPOSITORY, issue: 41, count: 1 });
  });

  it('files on the repository the setting names', async () => {
    const db = fakes();
    await fileBugReport({ report: report(), repo: 'omni/tracker', store: db.store, issues: db.issues });
    expect(db.created[0]?.repo).toBe('omni/tracker');
    expect(db.rows.get(FINGERPRINT)?.repo).toBe('omni/tracker');
  });

  it('adds a +1 with the kit version on a repeat, never a second issue', async () => {
    const db = fakes();
    await fileBugReport({ report: report(), store: db.store, issues: db.issues });
    const again = await fileBugReport({ report: report({ kitVersion: '0.0.700' }), store: db.store, issues: db.issues });
    expect(again).toEqual({ kind: 'repeat', repo: OMNI_LOOP_REPOSITORY, issue: 41, fingerprint: FINGERPRINT });
    expect(db.created).toHaveLength(1);
    expect(db.comments).toHaveLength(1);
    expect(db.comments[0]).toMatchObject({ issue: 41 });
    expect(db.comments[0]?.body).toContain('+1');
    expect(db.comments[0]?.body).toContain('0.0.700');
    expect(db.rows.get(FINGERPRINT)?.count).toBe(2);
  });

  it('turns into a repeat when another run recorded the fingerprint first', async () => {
    const db = fakes();
    const racing: BugReportStore = {
      ...db.store,
      find: (() => {
        let calls = 0;
        return (fingerprint: string) => {
          calls += 1;
          return calls === 1 ? Promise.resolve(null) : db.store.find(fingerprint);
        };
      })(),
      record: (row) => {
        db.rows.set(row.fingerprint, { ...row, issue: 7, count: 1 });
        return Promise.resolve(false);
      },
    };
    const filed = await fileBugReport({ report: report(), store: racing, issues: db.issues });
    expect(filed).toMatchObject({ kind: 'repeat', issue: 7 });
    expect(db.comments[0]).toMatchObject({ issue: 7 });
  });

  it('throws a GitHub refusal, files nothing and records nothing, for the ledger to retry', async () => {
    const db = fakes({ refuse: true });
    await expect(fileBugReport({ report: report(), store: db.store, issues: db.issues })).rejects.toThrow('GitHub refused');
    expect(db.rows.size).toBe(0);
  });

  it('writes the fixed fields and the signature, and says who wrote it', () => {
    const body = issueBody(report());
    expect(body).toContain('0.0.659');
    expect(body).toContain('/omni:yolo');
    expect(body).toContain(FINGERPRINT);
    expect(body).toContain('Omni App');
    expect(issueTitle(report())).toContain(FINGERPRINT.slice(0, 8));
  });

  it('holds no path, repository, login or email in the issue it files from a sensitive retro', async () => {
    const db = fakes();
    const sensitive = report({
      message: 'omni next failed reading /Users/octo-dev/work/widgets/src/a.ts of acme/widgets for octo-dev (dev@acme.example)',
      known: ['acme/widgets', 'octo-dev'],
    });
    await fileBugReport({ report: sensitive, store: db.store, issues: db.issues });
    const [issue] = db.created;
    const text = `${issue?.title ?? ''}\n${issue?.body ?? ''}`;
    for (const leak of ['/Users/octo-dev', 'acme/widgets', 'octo-dev', 'dev@acme.example']) expect(text).not.toContain(leak);
  });
});

describe('submitBugReport and the bug-report job', () => {
  const add = () => {
    const jobs: NewJob[] = [];
    return { jobs, add: (job: NewJob) => (jobs.push(job), Promise.resolve(true)) };
  };

  it('adds one job in its own lane holding the public report and nothing else', async () => {
    const queue = add();
    expect(await submitBugReport({ input: input(), attempt: 'repair-1', add: queue.add })).toEqual({ ok: true });
    expect(queue.jobs).toHaveLength(1);
    expect(queue.jobs[0]).toMatchObject({ kind: BUG_REPORT_KIND, lane: BUG_REPORT_LANE, key: `bug-report:${FINGERPRINT}:repair-1` });
    expect(Object.keys(queue.jobs[0]?.payload ?? {})).toEqual(['report']);
  });

  it('files nothing and says why when the scrub cannot prove the message clean (AC-6)', async () => {
    const queue = add();
    const refused = await submitBugReport({ input: input({ message: `the runner sent ${unknownToken} and was refused` }), attempt: 'repair-1', add: queue.add });
    expect(refused.ok).toBe(false);
    expect(refused.ok ? '' : refused.reason).toContain('token');
    expect(queue.jobs).toHaveLength(0);
  });

  it('files the job it was given through the filer, and hands the issue to the supervisor', async () => {
    const db = fakes();
    const seen: number[] = [];
    const handler = bugReportHandler({ issues: db.issues, store: db.store, log: () => undefined, onFiled: (filed) => (seen.push(filed.issue), Promise.resolve()) });
    const job = { id: 'j-1', kind: BUG_REPORT_KIND, payload: { report: report() } } as unknown as ClaimedJob;
    expect(await handler(job)).toEqual({ outcome: 'done' });
    expect(await handler(job)).toEqual({ outcome: 'done' });
    expect(db.created).toHaveLength(1);
    expect(db.comments).toHaveLength(1);
    expect(seen).toEqual([41, 41]);
  });

  it('throws a GitHub refusal so the ledger retries the job, and a malformed payload by the name of its field', async () => {
    const db = fakes({ refuse: true });
    const handler = bugReportHandler({ issues: db.issues, store: db.store, log: () => undefined });
    const job = { id: 'j-1', kind: BUG_REPORT_KIND, payload: { report: report() } } as unknown as ClaimedJob;
    await expect(handler(job)).rejects.toThrow('GitHub refused');
    await expect(handler({ ...job, payload: { report: { fingerprint: 'x' } } })).rejects.toThrow('bug-report job is malformed');
  });
});
