import { describe, expect, it } from 'vitest';
import { parsePr, parsePrd } from 'omni-loop/kit/lib/ids.ts';
import type { RewindFinding } from 'omni-loop/kit/lib/rewind/findings.ts';
import { AGENT_LINE } from './rewind.approval';
import type { DecidableFinding, FindingView } from './rewind.contract';
import { decisionService, rewindService, type DecisionPorts, type RewindPorts } from './rewind.service';

// The rewind's rules (PRD 2410, s5), on fake ports: the workspace is the caller's own, a finding is proposed
// once whatever became of it, and a refused push keeps nothing.

const PRD = parsePrd(7);
const finding = (more: Partial<RewindFinding> = {}): RewindFinding => ({
  check: 'ci', origin: 'repository', happened: 'The lint was red and merged.', evidence: ['https://a.test/1'], fix: 'Require the lint.', ...more,
});
const view = (more: Partial<FindingView> = {}): FindingView => ({
  id: 'f1', check: 'ci', origin: 'repository', happened: 'x', evidence: ['https://a.test/1'], fix: 'y', state: 'proposed', reason: null, decidedBy: null, decidedAt: null, outcome: null, ...more,
});

function ports(more: Partial<RewindPorts> & { stored?: FindingView[] } = {}) {
  const inserted: RewindFinding[][] = [];
  const fake: RewindPorts = {
    workspaceOf: () => Promise.resolve('w1'),
    mainWatch: () => Promise.resolve({ watches: [], breaks: [] }),
    findings: () => Promise.resolve(more.stored ?? []),
    insert: (_w, _r, _p, found) => { inserted.push([...found]); return Promise.resolve('ok'); },
    workspaceOfFinding: () => Promise.resolve('w1'),
    recordOutcome: () => Promise.resolve(null),
    ...more,
  };
  return { service: rewindService(fake), inserted };
}

describe('facts', () => {
  it('is empty for a PRD whose watch the caller cannot read', async () => {
    const { service } = ports({ workspaceOf: () => Promise.resolve(null) });
    expect(await service.facts('acme/widgets', PRD)).toEqual({ ok: true, value: { watches: [], breaks: [], findings: [] } });
  });

  it('carries the watch, its breaks and the findings', async () => {
    const stored = [view()];
    const { service } = ports({ stored, mainWatch: () => Promise.resolve({ watches: [], breaks: [] }) });
    expect(await service.facts('acme/widgets', PRD)).toEqual({ ok: true, value: { watches: [], breaks: [], findings: stored } });
  });
});

describe('outcome (PRD 2498, s2)', () => {
  const ID = '6f1c1b1e-8a0e-4c1f-9d55-2c1f7b0e9a11';

  it('records the outcome in the workspace of the finding the caller reads', async () => {
    const calls: unknown[] = [];
    const { service } = ports({ recordOutcome: (workspace, id, body) => { calls.push([workspace, id, body]); return Promise.resolve(null); } });
    expect(await service.outcome(ID, { outcome: 'proposed', pr: parsePr(42) })).toEqual({ ok: true, value: { outcome: 'proposed' } });
    expect(calls).toEqual([['w1', ID, { outcome: 'proposed', pr: parsePr(42) }]]);
  });

  it('answers missing for a finding the caller reads none of, and records nothing', async () => {
    const calls: unknown[] = [];
    const { service } = ports({ workspaceOfFinding: () => Promise.resolve(null), recordOutcome: () => { calls.push(1); return Promise.resolve(null); } });
    expect(await service.outcome(ID, { outcome: 'asks', note: 'Which form?' })).toMatchObject({ ok: false, kind: 'missing' });
    expect(calls).toEqual([]);
  });

  it('keeps the database\'s refusal: a second outcome, a finding not approved, a caller not allowed', async () => {
    for (const kind of ['recorded', 'unapproved', 'not-allowed'] as const) {
      const { service } = ports({ recordOutcome: () => Promise.resolve({ kind, error: `no: ${kind}` }) });
      expect(await service.outcome(ID, { outcome: 'already', note: 'playbook/testing#x' })).toEqual({ ok: false, kind, error: `no: ${kind}` });
    }
  });
});

describe('propose', () => {
  it('inserts the findings once, for the caller\'s workspace', async () => {
    const { service, inserted } = ports();
    expect(await service.propose('acme/widgets', PRD, [finding()])).toEqual({ ok: true, value: { added: 1 } });
    expect(inserted).toEqual([[finding()]]);
  });

  it('answers missing when the caller reads no watch for the PRD, and inserts nothing', async () => {
    const { service, inserted } = ports({ workspaceOf: () => Promise.resolve(null) });
    const done = await service.propose('acme/widgets', PRD, [finding()]);
    expect(done).toMatchObject({ ok: false, kind: 'missing' });
    expect(inserted).toEqual([]);
  });

  it.each(['proposed', 'approved', 'rejected'] as const)('refuses a finding already %s, naming it, and inserts nothing', async (state) => {
    const { service, inserted } = ports({ stored: [view({ state })] });
    const done = await service.propose('acme/widgets', PRD, [finding({ origin: 'knowledge' }), finding({ evidence: ['https://a.test/1'] })]);
    expect(done).toEqual({ ok: false, kind: 'duplicate', error: 'Finding 2 (ci, repository) was already proposed for PRD 7.' });
    expect(inserted).toEqual([]);
  });

  it('reads the same evidence in any order as the same finding', async () => {
    const { service } = ports({ stored: [view({ evidence: ['https://b.test/2', 'https://a.test/1'] })] });
    const done = await service.propose('acme/widgets', PRD, [finding({ evidence: ['https://a.test/1', 'https://b.test/2'] })]);
    expect(done).toMatchObject({ ok: false, kind: 'duplicate' });
  });

  it('refuses a push the database found repeated', async () => {
    const { service } = ports({ insert: () => Promise.resolve('duplicate') });
    expect(await service.propose('acme/widgets', PRD, [finding()])).toMatchObject({ ok: false, kind: 'duplicate' });
  });
});

// ── A member's decision (PRD 2410, s7) ──────────────────────────────────────────────────────────────────

const ID = '6f1c1b1e-8a0e-4c1f-9d55-2c1f7b0e9a11';
const decidable = (more: Partial<DecidableFinding> = {}): DecidableFinding => ({
  ...view({ id: ID, happened: 'The lint was red and merged.', fix: `Require the lint.\n${AGENT_LINE}` }),
  workspace: 'w1', repository: 'acme/widgets', prd: PRD, ...more,
});

type Sent = { queued: [string, string][]; proposed: [string, string, unknown][]; issues: [string, string][]; decided: unknown[][]; logged: string[] };

function decision(more: Partial<DecisionPorts> & { stored?: DecidableFinding | null } = {}) {
  const sent: Sent = { queued: [], proposed: [], issues: [], decided: [], logged: [] };
  const fake: DecisionPorts = {
    finding: () => Promise.resolve(more.stored === undefined ? decidable() : more.stored),
    approve: (workspace, id) => { sent.decided.push(['approve', workspace, id]); return Promise.resolve(null); },
    reject: (workspace, id, reason) => { sent.decided.push(['reject', workspace, id, reason]); return Promise.resolve(null); },
    queue: (repo, line) => { sent.queued.push([repo, line]); return Promise.resolve({ ok: true, link: '/app/runners' }); },
    propose: (workspace, repo, plan) => { sent.proposed.push([workspace, repo, plan]); return Promise.resolve({ ok: true, link: '/app/products/p1/knowledge' }); },
    openIssue: (title, body) => { sent.issues.push([title, body]); return Promise.resolve({ ok: true, link: 'https://github.com/vertuoza/vertuo-omni-loop/issues/9' }); },
    log: (line) => { sent.logged.push(line); },
    ...more,
  };
  return { service: decisionService(fake), sent };
}

describe('approve', () => {
  it('records the decision first, then queues /omni:bug-fix for a repository finding, sent by the member', async () => {
    const { service, sent } = decision();
    const done = await service.decide(ID, 'approve', null);
    expect(done).toEqual({ ok: true, value: { state: 'approved', followUp: { done: true, words: 'Queued /omni:bug-fix on a runner of the workspace, sent by you.', link: '/app/runners' } } });
    expect(sent.decided).toEqual([['approve', 'w1', ID]]);
    expect(sent.queued).toEqual([['acme/widgets', '/omni:bug-fix rewind of PRD 7: The lint was red and merged.']]);
  });

  it('files a glossary finding as a product knowledge proposal', async () => {
    const { service, sent } = decision({ stored: decidable({ origin: 'knowledge', fix: 'Add the glossary term `rewind`: the walk back from a break.' }) });
    const done = await service.decide(ID, 'approve', null);
    expect(done).toMatchObject({ ok: true, value: { state: 'approved', followUp: { done: true, words: 'Filed as a glossary proposal, for its owner to decide.', link: '/app/products/p1/knowledge' } } });
    expect(sent.proposed).toEqual([['w1', 'acme/widgets', { kind: 'proposal', knowledge: 'glossary', fields: { term: 'rewind', meaning: 'Add the glossary term `rewind`: the walk back from a break.' } }]]);
    expect(sent.queued).toEqual([]);
  });

  it('queues /omni:knowledge-add for another knowledge finding, and says it writes nothing on a runner yet', async () => {
    const { service, sent } = decision({ stored: decidable({ origin: 'knowledge', fix: 'Write it in the conventions form.' }) });
    const done = await service.decide(ID, 'approve', null);
    expect(done).toMatchObject({ ok: true, value: { followUp: { done: true, words: 'Queued /omni:knowledge-add on a runner of the workspace, sent by you. On a runner it writes nothing yet: the rule still waits for a person to write it.' } } });
    expect(sent.queued).toEqual([['acme/widgets', '/omni:knowledge-add rewind of PRD 7: Write it in the conventions form.']]);
  });

  it('opens one issue on the kit\'s repository for an Omni-setup finding', async () => {
    const { service, sent } = decision({ stored: decidable({ origin: 'omni-setup', happened: 'The pull request form never asked for the run link.' }) });
    const done = await service.decide(ID, 'approve', null);
    expect(done).toMatchObject({ ok: true, value: { followUp: { done: true, words: 'Opened an issue on the kit\'s repository.', link: 'https://github.com/vertuoza/vertuo-omni-loop/issues/9' } } });
    expect(sent.issues).toHaveLength(1);
    expect(sent.issues[0]?.[0]).toBe('Rewind: The pull request form never asked for the run link.');
  });

  it('refuses an Omni-setup finding that names the workspace\'s repository, and decides nothing', async () => {
    const { service, sent } = decision({ stored: decidable({ origin: 'omni-setup', happened: 'The kit broke acme/widgets.' }) });
    const done = await service.decide(ID, 'approve', null);
    expect(done).toMatchObject({ ok: false, kind: 'unshareable' });
    expect(sent.decided).toEqual([]);
    expect(sent.issues).toEqual([]);
  });

  it('keeps the approval when the follow-up fails, saying what to run instead, and logs it', async () => {
    const { service, sent } = decision({ queue: () => Promise.resolve({ ok: false, error: 'No runner is online.' }) });
    const done = await service.decide(ID, 'approve', null);
    expect(done).toEqual({ ok: true, value: { state: 'approved', followUp: {
      done: false, words: 'Approved, but /omni:bug-fix was not queued: No runner is online. Run it from a terminal: /omni:bug-fix rewind of PRD 7: The lint was red and merged.', link: null,
    } } });
    expect(sent.logged).toEqual(['rewind decide: /omni:bug-fix was not queued: No runner is online.']);
  });

  it('keeps the approval when the follow-up throws, without its words', async () => {
    const { service, sent } = decision({ stored: decidable({ origin: 'omni-setup' }), openIssue: () => Promise.reject(new Error('GitHub down')) });
    const done = await service.decide(ID, 'approve', null);
    expect(done).toMatchObject({ ok: true, value: { state: 'approved', followUp: { done: false, words: 'Approved, but the issue was not opened on the kit\'s repository. Open it there with the card\'s text.' } } });
    expect(JSON.stringify(done)).not.toContain('GitHub down');
    expect(sent.logged).toEqual(['rewind decide: the issue was not opened: GitHub down']);
  });
});

describe('reject', () => {
  it('keeps the finding with its reason, and sends nothing', async () => {
    const { service, sent } = decision();
    expect(await service.decide(ID, 'reject', 'Not our lint')).toEqual({ ok: true, value: { state: 'rejected', followUp: null } });
    expect(sent.decided).toEqual([['reject', 'w1', ID, 'Not our lint']]);
    expect([sent.queued, sent.proposed, sent.issues]).toEqual([[], [], []]);
  });
});

describe('a decision', () => {
  it('answers missing for a finding the member cannot read', async () => {
    const { service, sent } = decision({ stored: null });
    expect(await service.decide(ID, 'approve', null)).toMatchObject({ ok: false, kind: 'missing' });
    expect(sent.decided).toEqual([]);
  });

  it.each(['approved', 'rejected'] as const)('is refused a second time on a finding already %s, and sends nothing', async (state) => {
    const { service, sent } = decision({ stored: decidable({ state }) });
    for (const verdict of ['approve', 'reject'] as const) {
      expect(await service.decide(ID, verdict, null)).toEqual({ ok: false, kind: 'decided', error: `This finding was already ${state}: a decision is never rewritten.` });
    }
    expect([sent.decided, sent.queued, sent.issues]).toEqual([[], [], []]);
  });

  it('sends nothing when the database refuses the decision, two members deciding at once', async () => {
    const { service, sent } = decision({ approve: () => Promise.resolve('decided') });
    expect(await service.decide(ID, 'approve', null)).toMatchObject({ ok: false, kind: 'decided' });
    expect(sent.queued).toEqual([]);
  });

  it('answers not-allowed when the database finds no member', async () => {
    const { service } = decision({ reject: () => Promise.resolve('not-member') });
    expect(await service.decide(ID, 'reject', null)).toMatchObject({ ok: false, kind: 'not-allowed' });
  });
});
