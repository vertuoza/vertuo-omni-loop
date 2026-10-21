// `budgets-check` end to end against the stubbed GitHub of the outbox check (PRD 1679 s3): a signed
// webhook in, the real function run on every event it sent, each commit a folder on disk. Red over
// budget with `omni check context`'s own words; green with the table; neutral on a measurement error;
// nothing at all where budgets are off; and, on a product PRD's pull request, the server's
// `item-settled` re-check turning a raised ceiling green with no new push. No test calls GitHub or Supabase.
import { createHmac } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { InngestTestEngine } from '@inngest/test';
import { afterAll, describe, expect, it } from 'vitest';
import { roundUpToKib, setCeilings } from 'omni-loop/kit/lib/budgets/ceilings.ts';
import { measureContextBudget } from 'omni-loop/kit/lib/budgets/measure.ts';
import { raiseLine } from 'omni-loop/kit/lib/budgets/ratchet.ts';
import { CONFIG_FILE, parseConfig } from 'omni-loop/kit/lib/config.ts';
import { createContext } from 'omni-loop/kit/lib/context.ts';
import { parsePr } from 'omni-loop/kit/lib/ids.ts';
import { formText, makeRepo } from 'omni-loop/kit/test/fixture.ts';
import { main } from 'omni-loop/kit/bin/omni.ts';
import { BUDGETS_CHECK_EVENT, BUDGETS_EXTERNAL_ID, OUTBOX_CHECK_EVENT, type AppEvent, type CheckRequest, inngest } from '../inngest-client.ts';
import { checkRunAt, fakeGitHub, outputOf } from '../outbox-check/fake-github.ts';
import { createServerEventRecheck } from '../server-event/recheck.ts';
import { SERVER_EVENT } from '../server-event/server-event.ts';
import { receiveWebhook } from '../webhook/webhook.ts';
import { BUDGETS_FUNCTION_ID, createBudgetsCheck, createBudgetsFailureHandler } from './budgets-check.ts';
import { BUDGETS_CHECK_NAME } from './output.ts';
import type { OutboxRowsReader } from './raises.ts';

const SECRET = 'budgets-secret';
const REPOSITORY = { name: 'widgets', full_name: 'acme/widgets', owner: { login: 'acme' } };
const PLAYBOOK = '.omni-loop/knowledge/playbook';
const CEILINGS = '.omni-loop/budgets/context.json';
const GUIDE = 'guides/testing.md';
const GUIDE_TEXT = 'Run the whole suite before every push.\n'.repeat(20);
const BIG_GUIDE = 'Run the whole suite before every push, and read every log line twice.\n'.repeat(80);
const DOSSIER = '0b9e1f6c-3d0a-4f53-9a43-2f7a8e1c5d10';

const folders: string[] = [];
afterAll(() => {
  for (const folder of folders) rmSync(folder, { recursive: true, force: true });
});

type Files = Record<string, string>;

const config = (enabled: boolean) =>
  `kit: 1\nrepo:\n  slug: acme/widgets\npaths:\n  context: [AGENTS.md]\nbudgets:\n  context:\n    enabled: ${enabled}\n`;
const testingForm = (guide: string) =>
  formText({ frontMatter: { form: 'testing', state: 'filled' }, slots: [{ id: 'commands', required: true, body: `See: ${guide}` }] });

/** The base's files: budgets on (or off), a testing form pointing at its guide, one context file, PRD 7's folder. */
const baseFiles = (enabled = true): Files => ({
  [CONFIG_FILE]: config(enabled),
  [`${PLAYBOOK}/testing.md`]: testingForm(GUIDE),
  [GUIDE]: GUIDE_TEXT,
  'AGENTS.md': '# Agents\nRead the briefing.\n',
  '.omni-loop/delivery/inbox/0007-budgets/spec.md': '# Budgets\n',
});

/** `files` with every ceiling at its size today, rounded up, as `omni budget set context` writes them. */
function withCeilings(files: Files): Files {
  const root = folderOf(files);
  const ctx = createContext(root, parseConfig(files[CONFIG_FILE] ?? '', CONFIG_FILE));
  return { ...files, [CEILINGS]: `${JSON.stringify(setCeilings({}, measureContextBudget({ ctx })).ceilings, null, 2)}\n` };
}

/** A folder holding `files`: one commit of the stubbed GitHub. */
function folderOf(files: Files): string {
  const { root } = makeRepo({ files });
  folders.push(root);
  return root;
}

const BASE = withCeilings(baseFiles());
const ceilingsOf = (files: Files): Record<string, number> => JSON.parse(files[CEILINGS] ?? '{}') as Record<string, number>;
const overBudget = (): Files => ({ ...BASE, [GUIDE]: BIG_GUIDE });

/** The size the testing form prints with the big guide, its ceiling rounded up: the raise a person says yes to. */
const raisedCeiling = (): number => roundUpToKib(Number(ceilingsOf(withCeilings(overBudget()))['form:testing']));
const raised = (): Files => ({ ...overBudget(), [CEILINGS]: JSON.stringify({ ...ceilingsOf(BASE), 'form:testing': raisedCeiling() }) });

type Pull = { number: ReturnType<typeof parsePr>; base: { ref: string; sha: string }; head: { ref: string; sha: string }; labels: string[]; body?: string };
const pullOf = ({ head = 'feat/budgets', body }: { head?: string; body?: string } = {}): Pull => ({
  number: parsePr(31),
  base: { ref: 'main', sha: 'base1' },
  head: { ref: head, sha: 'head1' },
  labels: [],
  ...(body === undefined ? {} : { body }),
});

/** A commit of the range that changed `paths`, as GitHub lists it. */
type Change = { sha: string; message: string; paths: string[] };

/**
 * The stubbed GitHub of the outbox check, `base1` and `head1` the two commits, with the range's history
 * it does not serve: the compare's commits, and the commits that changed one path.
 */
function setUp({ base = BASE, head, pull = pullOf(), history = [] }: { base?: Files; head: Files; pull?: Pull; history?: Change[] }) {
  const github = fakeGitHub({ commits: { base1: folderOf(base), head1: folderOf(head) }, pull });
  const request = async (route: string, params: Record<string, unknown> = {}) => {
    if (route === 'GET /repos/{owner}/{repo}/commits') {
      github.state.requests.push({ route, ...params });
      return { data: history.filter(({ paths }) => paths.includes(String(params.path))).map(({ sha }) => ({ sha })) };
    }
    const answer = await github.octokit.request(route, params);
    if (route !== 'GET /repos/{owner}/{repo}/compare/{basehead}') return answer;
    return { data: { ...(answer.data as object), commits: history.map(({ sha, message }) => ({ sha, commit: { message } })) } };
  };
  return { github, octokit: { request } };
}

type Setup = ReturnType<typeof setUp>;

/** A signed delivery through `/api/github`'s unit; the events it sent. */
async function eventsOf(event: string, payload: Record<string, unknown>): Promise<AppEvent[]> {
  const body = JSON.stringify(payload);
  const sent: AppEvent[] = [];
  const response = await receiveWebhook({
    body,
    headers: { 'x-github-event': event, 'x-hub-signature-256': `sha256=${createHmac('sha256', SECRET).update(body).digest('hex')}` },
    secret: SECRET,
    forward: () => Promise.resolve(),
    send: (events) => Promise.resolve(sent.push(...events)),
  });
  expect(response.status).toBe(200);
  return sent;
}

const pullRequestEvents = (pull: Pull) =>
  eventsOf('pull_request', { action: 'synchronize', installation: { id: 7 }, repository: REPOSITORY, number: pull.number, pull_request: pull });

/** Every event through the real function; what each run returned. */
async function run({ octokit }: Setup, events: readonly AppEvent[], readOutboxRows: OutboxRowsReader | null = null, logged: string[] = []) {
  const fn = createBudgetsCheck({ client: inngest, octokitFor: () => octokit, readOutboxRows, log: (line) => logged.push(line) });
  const results: unknown[] = [];
  for (const event of events) {
    const { result, error } = await new InngestTestEngine({ function: fn, events: [event] }).execute();
    expect(error).toBeUndefined();
    results.push(result);
  }
  return results;
}

const budgetRuns = ({ github }: Setup) => github.state.checkRuns.filter((check) => check.name === BUDGETS_CHECK_NAME);
/** The `external_id` of every check run posted. */
const postedIds = ({ github }: Setup) => github.state.requests.filter(({ route }) => route === 'POST /repos/{owner}/{repo}/check-runs').map((posted) => posted.external_id);
const latest = (setup: Setup) => checkRunAt({ checkRuns: budgetRuns(setup) }, -1);

describe('budgets-check — the omni / budgets check run (PRD 1679 s3)', () => {
  it('posts nothing at all on a repository whose budgets.context.enabled is false', async () => {
    const off = withCeilings(baseFiles(false));
    const setup = setUp({ base: off, head: { ...off, [GUIDE]: BIG_GUIDE } });
    const [result] = await run(setup, await pullRequestEvents(pullOf()));
    expect(result).toMatchObject({ posted: false });
    expect(setup.github.state.checkRuns).toEqual([]);
  });

  it('posts nothing on a repository without the loop', async () => {
    const setup = setUp({ base: { 'README.md': '# Widgets\n' }, head: { 'README.md': '# Widgets\n' } });
    await run(setup, await pullRequestEvents(pullOf()));
    expect(setup.github.state.checkRuns).toEqual([]);
  });

  it('is green under every ceiling, with the table of target, size, ceiling and change', async () => {
    const setup = setUp({ head: BASE });
    await run(setup, await pullRequestEvents(pullOf()));
    const check = latest(setup);
    expect(check).toMatchObject({ status: 'completed', conclusion: 'success', head_sha: 'head1' });
    expect(postedIds(setup)).toEqual([BUDGETS_EXTERNAL_ID]);
    const { title, summary } = outputOf(check);
    expect(title).toBe('within budget');
    expect(summary).toContain('| target | size | ceiling | change |');
    expect(summary).toMatch(/\| `form:testing` \| [\d.]+ KB \| [\d.]+ KB \| — \|/);
    expect(summary).toContain('| `session` |');
  });

  it('is green when the pull request lowers a ceiling, the change in the table', async () => {
    const lowered = { ...BASE, [CEILINGS]: JSON.stringify({ ...ceilingsOf(BASE), 'context:AGENTS.md': 1024 }) };
    const higher = { ...BASE, [CEILINGS]: JSON.stringify({ ...ceilingsOf(BASE), 'context:AGENTS.md': 4096 }) };
    const setup = setUp({ base: higher, head: lowered });
    await run(setup, await pullRequestEvents(pullOf()));
    expect(latest(setup).conclusion).toBe('success');
    expect(outputOf(latest(setup)).summary).toContain('| `context:AGENTS.md` | 28 bytes | 1 KB | -3 KB |');
  });

  it('is red over budget, its text the one omni check context prints, what grew with its commits', async () => {
    const history = [{ sha: 'a1b2c3d4e5f6', message: 'docs: a longer testing guide\n\nWith more lines.', paths: [GUIDE] }, { sha: 'ffff000011', message: 'chore: other', paths: ['README.md'] }];
    const setup = setUp({ head: overBudget(), history });
    await run(setup, await pullRequestEvents(pullOf()));
    const check = latest(setup);
    expect(check.conclusion).toBe('failure');
    const { title, summary } = outputOf(check);
    expect(title).toBe('1 target over budget');
    expect(summary).toContain('Over budget: the `testing` playbook form is');
    expect(summary).toContain('Why it matters: every AI agent working here reads this before it starts');
    expect(summary).toMatch(/- `guides\/testing\.md` \+[\d.]+ KB since the base/);
    expect(summary).toContain('  - a1b2c3d docs: a longer testing guide');
    expect(summary).not.toContain('ffff000');
    expect(summary).toContain('`/omni:pr-care` (or `/omni:yolo-fix 7`) handles it by itself');
    expect(summary).toContain('file a high outbox item of PRD 7');

    const local = await checkContextLocally(BASE, overBudget());
    const ours = summary.split('\n').filter((line) => line.trim() !== '' && !/^ {2}- [0-9a-f]{7} /.test(line));
    for (const line of ours) expect(local).toContain(line.trim());
  });

  it('offers the trim only on a pull request that belongs to no PRD', async () => {
    const setup = setUp({ head: overBudget(), pull: pullOf({ head: 'chore/tidy' }) });
    await run(setup, await pullRequestEvents(pullOf({ head: 'chore/tidy' })));
    const { summary } = outputOf(latest(setup));
    expect(summary).toContain('this pull request belongs to no PRD, so its ceiling cannot be raised here');
    expect(summary).not.toContain('/omni:pr-care');
  });

  it('is red "needs a person\'s yes" on a raised ceiling, and green once the PRD\'s ledger holds the settled raise', async () => {
    const waiting = setUp({ head: raised() });
    await run(waiting, await pullRequestEvents(pullOf()));
    expect(latest(waiting).conclusion).toBe('failure');
    expect(outputOf(latest(waiting)).title).toBe("1 ceiling raised, waiting on a person's yes");
    expect(outputOf(latest(waiting)).summary).toContain("Needs a person's yes: this PR raises the ceiling of the `testing` playbook form");

    const answered = setUp({ head: { ...raised(), '.omni-loop/delivery/outbox/0007-budgets/settled.md': settledLedger(raisedCeiling()) } });
    await run(answered, await pullRequestEvents(pullOf()));
    expect(latest(answered).conclusion).toBe('success');
  });

  it('a raise settled for another ceiling does not match', async () => {
    const setup = setUp({ head: { ...raised(), '.omni-loop/delivery/outbox/0007-budgets/settled.md': settledLedger(raisedCeiling() + 1024) } });
    await run(setup, await pullRequestEvents(pullOf()));
    expect(latest(setup).conclusion).toBe('failure');
  });

  it('is neutral, saying why, when a form\'s pointer leads nowhere', async () => {
    const broken = { ...BASE, [`${PLAYBOOK}/testing.md`]: testingForm('docs/run.md') };
    const setup = setUp({ head: broken });
    await run(setup, await pullRequestEvents(pullOf()));
    const check = latest(setup);
    expect(check.conclusion).toBe('neutral');
    expect(outputOf(check).title).toBe('not measured');
    expect(outputOf(check).summary).toContain('See: docs/run.md does not exist');
    expect(outputOf(check).summary).toContain('A measurement that fails never blocks a merge.');
  });

  it('is neutral when the head\'s config does not parse', async () => {
    const setup = setUp({ head: { ...BASE, [CONFIG_FILE]: 'kit: 1\nnot: a key\n' } });
    await run(setup, await pullRequestEvents(pullOf()));
    expect(latest(setup).conclusion).toBe('neutral');
    expect(outputOf(latest(setup)).summary).toContain('Not measured: the head\'s .omni-loop/config.yml cannot be read');
  });

  it('is red, as the command is, when the ceilings file does not parse', async () => {
    const setup = setUp({ head: { ...BASE, [CEILINGS]: '{ "form:testing": "big" }' } });
    await run(setup, await pullRequestEvents(pullOf()));
    expect(latest(setup).conclusion).toBe('failure');
    expect(outputOf(latest(setup)).summary).toContain(CEILINGS);
  });

  it('runs again on a re-run of its own check run, which the webhook tells by its external id', async () => {
    const events = await eventsOf('check_run', {
      action: 'rerequested',
      installation: { id: 7 },
      repository: REPOSITORY,
      check_run: { head_sha: 'head1', external_id: BUDGETS_EXTERNAL_ID, pull_requests: [{ number: 31, head: { sha: 'head1' } }] },
    });
    expect(events.map(({ name }) => name)).toEqual([BUDGETS_CHECK_EVENT]);
    const setup = setUp({ head: BASE });
    await run(setup, events);
    expect(latest(setup).conclusion).toBe('success');
  });

  it('posts the check again, green with no new push, when item-settled answers a product PRD\'s raise', async () => {
    const pull = pullOf({ head: 'feat/offline', body: 'Offline.\n\nPart of mobile-12' });
    const setup = setUp({ head: raised(), pull });
    const rows = { prdId: 'mobile-12', items: [{ item: 's1-01-raise-testing', rank: 'high', body: raiseItem(raisedCeiling()), settlement: null as null | object }] };
    const reads: string[] = [];
    const readOutboxRows: OutboxRowsReader = (repository, prd) => {
      reads.push(`${repository} ${prd}`);
      return Promise.resolve(structuredClone(rows));
    };
    await run(setup, await pullRequestEvents(pull), readOutboxRows);
    expect(latest(setup).conclusion).toBe('failure');
    expect(reads).toEqual(['acme/widgets mobile-12']);

    rows.items[0] = { ...rows.items[0], settlement: { verdict: 'agreed', basis: 'answered', settledAt: '2026-10-12T10:00:00Z' } } as (typeof rows.items)[0];
    const recheck = createServerEventRecheck({
      client: inngest,
      octokitFor: () => setup.octokit,
      readTargets: () => Promise.resolve({ prdId: 'mobile-12', installationId: 7, pulls: [{ repository: 'acme/widgets', number: 31 }] }),
    });
    const { ctx } = await new InngestTestEngine({ function: recheck, events: [{ name: SERVER_EVENT, data: { event: 'item-settled', dossier: DOSSIER, at: '2026-10-12T10:00:00Z' } }] }).execute();
    const sent = sentEvents(ctx);
    expect(sent.map(({ name }) => name)).toEqual([OUTBOX_CHECK_EVENT]);
    await run(setup, sent, readOutboxRows);
    expect(budgetRuns(setup)).toHaveLength(2);
    expect(latest(setup)).toMatchObject({ conclusion: 'success', head_sha: 'head1' });
  });

  it('reads no raise of a product PRD when the App cannot read the server, saying so', async () => {
    const pull = pullOf({ head: 'feat/offline', body: 'Part of mobile-12' });
    const setup = setUp({ head: raised(), pull });
    const logged: string[] = [];
    await run(setup, await pullRequestEvents(pull), null, logged);
    expect(latest(setup).conclusion).toBe('failure');
    expect(logged.join('\n')).toContain('the raises of PRD mobile-12 are not read');
  });

  it('serves under its own id', () => {
    expect(createBudgetsCheck({ client: inngest, octokitFor: () => setUp({ head: BASE }).octokit }).id()).toBe(BUDGETS_FUNCTION_ID);
  });
});

describe('budgets-check — its failure handler (D6: a check that cannot run never blocks a merge)', () => {
  const failed = (setup: Setup) =>
    createBudgetsFailureHandler({ octokitFor: () => setup.octokit })({
      event: { data: { event: { data: { installationId: 7, owner: 'acme', repo: 'widgets', repository: 'acme/widgets', prNumber: 31, headSha: 'head1' } }, error: { message: 'step timed out' } } },
    });

  it('posts the check neutral, saying why, where budgets are on', async () => {
    const setup = setUp({ head: BASE });
    await failed(setup);
    expect(latest(setup).conclusion).toBe('neutral');
    expect(postedIds(setup)).toEqual([BUDGETS_EXTERNAL_ID]);
    expect(outputOf(latest(setup)).summary).toContain('Not measured: the check could not run — step timed out.');
  });

  it('posts nothing where budgets are off', async () => {
    const off = withCeilings(baseFiles(false));
    const setup = setUp({ base: off, head: off });
    expect(await failed(setup)).toMatchObject({ posted: false });
    expect(setup.github.state.checkRuns).toEqual([]);
  });
});

/** The events a run sent, by the step's `sendEvent`. */
function sentEvents(ctx: unknown): CheckRequest[] {
  const send = (ctx as { step: { sendEvent: { mock: { calls: unknown[][] } } } }).step.sendEvent;
  return send.mock.calls.flatMap((call) => call[1] as CheckRequest[]);
}

/** A high item that asks to raise the testing form's ceiling to `ceiling`. */
function raiseItem(ceiling: number): string {
  return ['---', 'id: s1-01-raise-testing', 'prd: 7', 'slice: s1', 'rank: high', '---', '', '## What I had to decide', '', raiseLine('form:testing', ceiling), ''].join('\n');
}

/** PRD 7's ledger, holding the raise to `ceiling`, agreed. */
function settledLedger(ceiling: number): string {
  return [
    '# Settled outbox items — PRD 7',
    '',
    '<!-- omni-outbox-settled: s1-01-raise-testing -->',
    '',
    '## s1-01-raise-testing — agreed',
    '',
    '- Verdict: agreed',
    '- Approved by: pm',
    '',
    '### The answer, as it was given',
    '',
    '```text',
    'Yes, the testing form needs the room.',
    '```',
    '',
    '### The item, as it was raised',
    '',
    '````text',
    raiseItem(ceiling),
    '````',
    '',
    '<!-- /omni-outbox-settled: s1-01-raise-testing -->',
    '',
  ].join('\n');
}

/** What `omni check context` prints in a git checkout of `head` on `feat/budgets`, branched from `base` on `main`. */
async function checkContextLocally(base: Files, head: Files): Promise<string> {
  const { root } = makeRepo({ git: true, files: base });
  folders.push(root);
  const git = (...args: string[]) => execFileSync('git', args, { cwd: root, stdio: 'ignore' });
  git('checkout', '-q', '-b', 'feat/budgets');
  for (const [path, text] of Object.entries(head)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), text);
  }
  git('add', '-A');
  git('-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-q', '-m', 'grow');
  const out: string[] = [];
  const write = (s: string) => out.push(s);
  await main(['check', 'context', '--base', 'main'], { cwd: root, stdout: { write }, stderr: { write } });
  return out.join('');
}
