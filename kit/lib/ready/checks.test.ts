// PRD 2898, s1: the ready rule as a table — each of the five checks passing, failing, not finished and
// not judged; the verdict ready only on five passes (BL-GATE-1); what excuses a finding (BL-ASK-1).
import { describe, expect, it } from 'vitest';
import { parseOutboxItemId } from '../ids.ts';
import { parseCriteria } from './criteria.ts';
import { readyVerdict, READY_CHECK_NAME } from './checks.ts';
import type { CheckRun, ReadyFacts } from './checks.ts';
import type { ExcuseItem } from './excuses.ts';
import type { DiffFile } from './loosening.ts';
import { ACCEPTANCE_CHECK_NAME, ACCEPTANCE_REPORT_FORMAT } from './report.ts';
import type { AcceptanceReport } from './report.ts';

const HEAD = 'b'.repeat(40);
const SKIP = ['it', 'skip'].join('.');

const run = (name: string, conclusion: string | null = 'success', status: CheckRun['status'] = 'completed'): CheckRun => ({ name, status, conclusion, url: `https://ci.example/${name}` });

const SPEC = ['### AC-1 · test', '', '```gherkin', 'Scenario: one', '  Given a', '  When b', '  Then c', '```', '', '### AC-2 · e2e', '', '```gherkin', 'Scenario: two', '  Given a', '  When b', '  Then c', '```', ''].join('\n');

const report = (results: AcceptanceReport['results'], commit = HEAD): AcceptanceReport => ({ format: ACCEPTANCE_REPORT_FORMAT, commit, results });
const proof = (ac: number, kind: 'test' | 'e2e', state: AcceptanceReport['results'][number]['state'] = 'passed', why?: string) => ({
  ac, kind, state, title: `AC-${String(ac)}: x`, proof: 'kit/x.test.ts', ...(why === undefined ? {} : { why }),
});

const TEST_FILE = "describe('x', () => {\n  it('a', () => {\n    expect(1).toBe(1);\n  });\n});\n";

/** Facts on which all five checks pass. */
function facts(patch: Partial<ReadyFacts> = {}): ReadyFacts {
  return {
    head: HEAD,
    runs: { ok: true, value: [run('test'), run('lint'), run('quick'), run(ACCEPTANCE_CHECK_NAME)] },
    full: ['test', 'lint'],
    criteria: { ok: true, value: parseCriteria(SPEC) },
    baseCriteria: { ok: true, value: [] },
    report: { ok: true, value: report([proof(1, 'test'), proof(2, 'e2e')]) },
    diff: { ok: true, value: [{ path: 'kit/lib/ready/checks.ts', status: 'added', before: null, after: 'export const a = 1;\n' }] },
    area: { ok: true, value: { territories: ['kit/lib/ready/'], prdFolders: ['.omni-loop/delivery/inbox/2898-ready-five-checks/'], generated: ['kit/dist/'] } },
    ledger: { ok: true, value: [] },
    ...patch,
  };
}

const check = (patch: Partial<ReadyFacts>, id: string) => {
  const found = readyVerdict(facts(patch)).checks.find((result) => result.id === id);
  return found === undefined ? 'missing' : `${found.state}${found.why === '' ? '' : ` · ${found.why}`}`;
};

const item = (verdict: string | null, excuses: string[]): ExcuseItem => ({ item: parseOutboxItemId('s1-01-label-style'), verdict, excuses });
const unreadable = { ok: false as const, why: 'gh answered 502' };

describe('the verdict (PRD 2898, BL-GATE-1)', () => {
  it('is ready only when all five checks pass, in their order', () => {
    const verdict = readyVerdict(facts());
    expect(verdict.checks.map(({ id, state }) => `${id} ${state}`)).toEqual(['ci pass', 'full pass', 'acceptance pass', 'loosening pass', 'area pass']);
    expect(verdict).toMatchObject({ ready: true, state: 'ready', passed: 5, headline: 'Ready for review · 5 of 5' });
  });

  it('is not ready on one failing check, naming it first', () => {
    const verdict = readyVerdict(facts({ runs: { ok: true, value: [run('test'), run('lint', 'failure'), run(ACCEPTANCE_CHECK_NAME)] } }));
    expect(verdict).toMatchObject({ ready: false, state: 'not ready', passed: 3 });
    expect(verdict.headline).toBe('Not ready · 3 of 5 · CI green on the latest commit: fail');
  });

  it('is not finished, never ready, on one check not finished or not judged and none failing', () => {
    const running = readyVerdict(facts({ runs: { ok: true, value: [run('test', null, 'in_progress'), run('lint'), run(ACCEPTANCE_CHECK_NAME)] } }));
    expect(running).toMatchObject({ ready: false, state: 'not finished' });
    expect(running.headline).toBe('Not finished · 3 of 5 · CI green on the latest commit: not finished');
    const unjudged = readyVerdict(facts({ ledger: unreadable, diff: { ok: true, value: [{ path: 'docs/x.md', status: 'added', before: null, after: 'x' }] } }));
    expect(unjudged).toMatchObject({ ready: false, state: 'not finished', passed: 4 });
  });

  it('gives each check its title and, when the facts carry one, its evidence link', () => {
    const verdict = readyVerdict(facts({ evidence: { ci: 'https://github.example/pr/1/checks' } }));
    expect(verdict.checks.map(({ title }) => title)).toEqual([
      'CI green on the latest commit',
      'The full tests and lint ran',
      'Every acceptance criterion has its proof',
      'No test was loosened',
      'The change stayed in its area',
    ]);
    expect(verdict.checks[0]?.evidence).toBe('https://github.example/pr/1/checks');
    expect(verdict.checks[1]?.evidence).toBeNull();
  });
});

describe('check 1: CI green on the latest commit (PRD 2898)', () => {
  it('passes when every check run finished success, its own check left out', () => {
    expect(check({ runs: { ok: true, value: [run('test'), run(READY_CHECK_NAME, 'failure')] } }, 'ci')).toBe('pass · 1 check green');
  });

  it('fails on a run that failed, skipped or was cancelled, naming each', () => {
    const runs = [run('test'), run('lint', 'failure'), run('quick', 'skipped'), run('e2e', 'cancelled')];
    expect(check({ runs: { ok: true, value: runs } }, 'ci')).toBe('fail · not green: lint (failure), quick (skipped), e2e (cancelled)');
  });

  it('is not finished while a run is going or none has started', () => {
    expect(check({ runs: { ok: true, value: [run('test'), run('lint', null, 'queued')] } }, 'ci')).toBe('not finished · still running: lint');
    expect(check({ runs: { ok: true, value: [run(READY_CHECK_NAME)] } }, 'ci')).toBe('not finished · no check has run on the latest commit yet');
  });

  it('is not judged when the runs could not be read', () => {
    expect(check({ runs: unreadable }, 'ci')).toBe('not judged · gh answered 502');
  });
});

describe('check 2: the full tests and lint ran (PRD 2898)', () => {
  it('passes when each job ready.full names succeeded, a matrix job by its every leg', () => {
    expect(check({}, 'full')).toBe('pass · test and lint succeeded');
    expect(check({ full: ['test'], runs: { ok: true, value: [run('test (1)'), run('test (2)')] } }, 'full')).toBe('pass · test succeeded');
  });

  it('never counts another job: quick is not test, nor is a test shard', () => {
    expect(check({ runs: { ok: true, value: [run('quick'), run('test shard 1/3'), run('lint')] } }, 'full')).toBe('not finished · test has not run on the latest commit yet');
  });

  it('fails on a full job that did not succeed', () => {
    expect(check({ runs: { ok: true, value: [run('test', 'skipped'), run('lint')] } }, 'full')).toBe('fail · test did not succeed (skipped)');
  });

  it('is not finished while a full job runs (AC-3\'s rule)', () => {
    expect(check({ runs: { ok: true, value: [run('test', null, 'in_progress'), run('lint')] } }, 'full')).toBe('not finished · still running: test');
  });

  it('is not judged when ready.full names no job, or the runs could not be read', () => {
    expect(check({ full: [] }, 'full')).toBe('not judged · ready.full names no CI job');
    expect(check({ runs: unreadable }, 'full')).toBe('not judged · gh answered 502');
  });
});

describe('check 3: every acceptance criterion has its proof (PRD 2898)', () => {
  it('passes when each criterion passed on the latest commit, by a proof of its own kind', () => {
    expect(check({}, 'acceptance')).toBe('pass · 2 of 2 criteria proven');
  });

  it('fails naming each criterion with no proof, a failed proof or a proof of the other kind (AC-5\'s rule)', () => {
    expect(check({ report: { ok: true, value: report([proof(1, 'test')]) } }, 'acceptance')).toBe('fail · AC-2 has no proof on this commit');
    expect(check({ report: { ok: true, value: report([proof(1, 'test', 'failed'), proof(2, 'e2e')]) } }, 'acceptance')).toBe('fail · AC-1 failed');
    expect(check({ report: { ok: true, value: report([proof(1, 'test'), proof(2, 'test')]) } }, 'acceptance')).toBe('fail · AC-2 is e2e, proven only by a test run');
    expect(check({ report: { ok: true, value: report([proof(1, 'test', 'skipped'), proof(2, 'e2e')]) } }, 'acceptance')).toBe('fail · AC-1 was skipped');
  });

  it('fails a spec with no numbered criterion, and one whose criteria are malformed', () => {
    expect(check({ criteria: { ok: true, value: parseCriteria('## Acceptance criteria\n\n- it works\n') } }, 'acceptance')).toBe('fail · the spec has no criterion written ### AC-<n> · <kind>');
    expect(check({ criteria: { ok: true, value: parseCriteria(`${SPEC}\n### AC-2 · test\n`) } }, 'acceptance')).toBe('fail · the spec\'s criteria are malformed: AC-2 is written twice');
  });

  it('is not finished while a proof waits, the report is missing or of an older commit, or its run is going', () => {
    const pending = report([proof(1, 'test'), proof(2, 'e2e', 'pending', 'no runner has run the e2e scenarios yet')]);
    expect(check({ report: { ok: true, value: pending } }, 'acceptance')).toBe('not finished · AC-2: no runner has run the e2e scenarios yet');
    expect(check({ report: { ok: true, value: null }, runs: { ok: true, value: [run('test')] } }, 'acceptance')).toBe('not finished · no acceptance report on the latest commit yet');
    expect(check({ report: { ok: true, value: null }, runs: { ok: true, value: [run(ACCEPTANCE_CHECK_NAME, null, 'in_progress')] } }, 'acceptance')).toBe('not finished · the acceptance run is still going');
    expect(check({ report: { ok: true, value: report([proof(1, 'test'), proof(2, 'e2e')], 'c'.repeat(40)) } }, 'acceptance')).toBe('not finished · the acceptance report is of cccccccc, not the latest commit bbbbbbbb');
  });

  it('fails, never waits, when one criterion failed and another waits', () => {
    expect(check({ report: { ok: true, value: report([proof(1, 'test', 'failed'), proof(2, 'e2e', 'pending')]) } }, 'acceptance')).toBe('fail · AC-1 failed; AC-2 is still waiting');
  });

  it('is not judged when the spec or the report could not be read, or the run left no report', () => {
    expect(check({ criteria: unreadable }, 'acceptance')).toBe('not judged · gh answered 502');
    expect(check({ report: unreadable }, 'acceptance')).toBe('not judged · gh answered 502');
    expect(check({ report: { ok: true, value: null } }, 'acceptance')).toBe('not judged · the acceptance run finished with no report');
  });
});

describe('check 4: no test was loosened (PRD 2898)', () => {
  const skipped: DiffFile = { path: 'kit/x.test.ts', status: 'modified', before: TEST_FILE, after: TEST_FILE.replace("it('a'", `${SKIP}('a'`) };

  it('fails on a loosening no item excuses, naming the file and what (AC-2\'s rule)', () => {
    expect(check({ diff: { ok: true, value: [skipped] } }, 'loosening')).toBe('fail · kit/x.test.ts: .skip added');
  });

  it('passes on a loosening an agreed item names, naming the item', () => {
    expect(check({ diff: { ok: true, value: [skipped] }, ledger: { ok: true, value: [item('agreed', ['kit/x.test.ts'])] } }, 'loosening')).toBe('pass · kit/x.test.ts excused by s1-01-label-style');
  });

  it('is never excused by an adopted, a drifted or an open item, nor by one without the path (BL-ASK-1)', () => {
    for (const [verdict, excuses, note] of [
      ['adopted', ['kit/x.test.ts'], ' (s1-01-label-style names it, but was adopted, never answered by a person)'],
      ['drifted', ['kit/x.test.ts'], ' (s1-01-label-style names it, but its answer drifted from what was built)'],
      [null, ['kit/x.test.ts'], ' (s1-01-label-style names it, but is still open)'],
      ['agreed', ['kit/y.test.ts'], ''],
    ] as const) {
      expect(check({ diff: { ok: true, value: [skipped] }, ledger: { ok: true, value: [item(verdict, [...excuses])] } }, 'loosening'), String(verdict)).toBe(`fail · kit/x.test.ts: .skip added${note}`);
    }
  });

  it('never reads a generated path of the area', () => {
    const bundle: DiffFile = { path: 'kit/dist/omni.mjs', status: 'modified', before: null, after: null };
    expect(check({ diff: { ok: true, value: [bundle] } }, 'loosening')).toBe('pass · no test was loosened');
  });

  it('names the first three findings and counts the rest', () => {
    const files: DiffFile[] = ['a', 'b', 'c', 'd'].map((name) => ({ path: `kit/${name}.test.ts`, status: 'deleted', before: TEST_FILE, after: null }));
    expect(check({ diff: { ok: true, value: files } }, 'loosening')).toBe('fail · kit/a.test.ts: the test file was deleted; kit/b.test.ts: the test file was deleted; kit/c.test.ts: the test file was deleted; and 1 more');
  });

  it('is not judged when the diff could not be read, a file it needs could not be, or the outbox could not be with a finding to excuse', () => {
    expect(check({ diff: unreadable }, 'loosening')).toBe('not judged · gh answered 502');
    expect(check({ diff: { ok: true, value: [{ path: 'kit/x.test.ts', status: 'modified', before: null, after: TEST_FILE }] } }, 'loosening')).toBe('not judged · kit/x.test.ts: its content could not be read');
    expect(check({ diff: { ok: true, value: [skipped] }, ledger: unreadable }, 'loosening')).toBe('not judged · the outbox could not be read: gh answered 502');
    expect(check({ ledger: unreadable }, 'loosening')).toBe('pass · no test was loosened');
  });

  it('reads a changed AC test against the spec at both ends, and leaves it unjudged when the base spec is unread', () => {
    const acTest = (title: string) => `describe('x', () => {\n  it('${title}', () => {\n    expect(1).toBe(1);\n  });\n});\n`;
    const changed: DiffFile = { path: 'kit/ac.test.ts', status: 'modified', before: acTest('AC-1: one'), after: acTest('AC-1: another') };
    const base = parseCriteria(SPEC).criteria;
    expect(check({ diff: { ok: true, value: [changed] }, baseCriteria: { ok: true, value: base } }, 'loosening')).toBe('fail · kit/ac.test.ts: AC-1\'s test changed while the spec\'s AC-1 did not');
    expect(check({ diff: { ok: true, value: [changed] }, baseCriteria: unreadable }, 'loosening')).toBe('not judged · kit/ac.test.ts: AC-1\'s test changed, and the spec could not be read at both ends');
  });
});

describe('check 5: the change stayed in its area (PRD 2898)', () => {
  const outside: DiffFile = { path: 'kit/lib/init/labels.ts', status: 'modified', before: 'a', after: 'b' };

  it('passes a diff inside the territories, the PRD\'s folder and the generated paths', () => {
    const inside: DiffFile[] = [
      { path: 'kit/lib/ready/a.ts', status: 'added', before: null, after: 'x' },
      { path: '.omni-loop/delivery/inbox/2898-ready-five-checks/plan.md', status: 'modified', before: 'a', after: 'b' },
      { path: 'kit/dist/omni.mjs', status: 'modified', before: 'a', after: 'b' },
    ];
    expect(check({ diff: { ok: true, value: inside } }, 'area')).toBe('pass · every file sits in its area');
  });

  it('fails a file outside every territory, naming it', () => {
    expect(check({ diff: { ok: true, value: [outside] } }, 'area')).toBe('fail · outside every territory: kit/lib/init/labels.ts');
  });

  it('reads a renamed file at both its paths', () => {
    const moved: DiffFile = { path: 'kit/lib/ready/labels.ts', previousPath: 'kit/lib/init/labels.ts', status: 'renamed', before: 'a', after: 'a' };
    expect(check({ diff: { ok: true, value: [moved] } }, 'area')).toBe('fail · outside every territory: kit/lib/init/labels.ts');
  });

  it('passes a file an agreed or an adopted item names, naming the item (AC-4\'s rule)', () => {
    for (const verdict of ['agreed', 'adopted']) {
      expect(check({ diff: { ok: true, value: [outside] }, ledger: { ok: true, value: [item(verdict, ['kit/lib/init/labels.ts'])] } }, 'area'), verdict).toBe('pass · every file sits in its area; kit/lib/init/labels.ts excused by s1-01-label-style');
    }
  });

  it('is never excused by a drifted or an open item, nor one naming its folder (BL-ASK-1)', () => {
    expect(check({ diff: { ok: true, value: [outside] }, ledger: { ok: true, value: [item('drifted', ['kit/lib/init/labels.ts'])] } }, 'area')).toBe(
      'fail · outside every territory: kit/lib/init/labels.ts (s1-01-label-style names it, but its answer drifted from what was built)',
    );
    expect(check({ diff: { ok: true, value: [outside] }, ledger: { ok: true, value: [item(null, ['kit/lib/init/labels.ts'])] } }, 'area')).toBe(
      'fail · outside every territory: kit/lib/init/labels.ts (s1-01-label-style names it, but is still open)',
    );
    expect(check({ diff: { ok: true, value: [outside] }, ledger: { ok: true, value: [item('agreed', ['kit/lib/init/'])] } }, 'area')).toBe('fail · outside every territory: kit/lib/init/labels.ts');
  });

  it('is not judged when the diff, the plan or, with a file to excuse, the outbox could not be read', () => {
    expect(check({ diff: unreadable }, 'area')).toBe('not judged · gh answered 502');
    expect(check({ area: unreadable }, 'area')).toBe('not judged · gh answered 502');
    expect(check({ diff: { ok: true, value: [outside] }, ledger: unreadable }, 'area')).toBe('not judged · the outbox could not be read: gh answered 502');
  });
});
