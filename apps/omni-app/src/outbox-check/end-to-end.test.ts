// In-process, from a signed webhook to a completed check, against a stubbed GitHub: PRD 28's
// acceptance criteria 1–6, which a person re-runs live once the app is registered and installed. The
// check reads the stub through the app's own installation Octokit, built on the shared budget-aware
// client (PRD 902, s5), so every call spends installation 7's budget, and a paused budget refuses it.
import { parsePr, type PrNumber } from 'omni-loop/kit/lib/ids.ts';
import { createHmac, generateKeyPairSync } from 'node:crypto';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { parseConfig } from 'omni-loop/kit/lib/config.ts';
import { createContext } from 'omni-loop/kit/lib/context.ts';
import { adoptItem, settleItem } from 'omni-loop/kit/lib/outbox/settle.ts';
import { fileURLToPath } from 'node:url';
import { InngestTestEngine } from '@inngest/test';
import { githubClient, memoryGithubStore, type GithubStore } from '@omni/github';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { assertDefined } from 'omni-loop/kit/test/assert.ts';
import { type AppEvent, inngest } from '../inngest-client.ts';
import { receiveWebhook } from '../webhook/webhook.ts';
import { installationOctokitFor } from '../octokit-for.ts';
import { RECORD_MARKER } from 'omni-loop/kit/lib/escalation/comments.ts';
import { checkRunAt, commitOf, fakeGitHub, outputOf, overHttp } from './fake-github.ts';
import { createOutboxCheck } from './outbox-check.ts';

const FIXTURES = fileURLToPath(new URL('../../test/fixtures/', import.meta.url));
const fixture = (name: string) => join(FIXTURES, name);
const SECRET = 'e2e-secret';

const REPOSITORY = { name: 'widgets', full_name: 'acme/widgets', owner: { login: 'acme' } };
const INSTALLATION = 7;

/** The GitHub App the check signs its installation token with: a key made for this file. */
const GITHUB_APP = {
  id: '1',
  privateKey: generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey.export({ type: 'pkcs1', format: 'pem' }).toString(),
};

/** What every answer of the stub reports of installation 7's budget. */
const HOUR = 3_600_000;
const RATE = Object.freeze({
  'x-ratelimit-limit': '5000',
  'x-ratelimit-remaining': '4900',
  'x-ratelimit-reset': String(Math.floor((Date.now() + HOUR) / 1000)),
  'x-ratelimit-resource': 'core',
});

/** A pull request as a delivery carries it. */
type Pull = { number: PrNumber; base: { ref: string; sha: string }; head: { ref: string; sha: string }; labels?: string[]; body?: string };
/** A delivery to `/api/github`: its event and its payload. */
type Delivery = { event: string; payload: Record<string, unknown> };
type GitHub = ReturnType<typeof fakeGitHub>;

function pullRequestDelivery(pull: Pull, action = 'synchronize'): Delivery {
  return {
    event: 'pull_request',
    payload: { action, installation: { id: 7 }, repository: REPOSITORY, number: pull.number, pull_request: pull },
  };
}

/** A review of the pull request, submitted or dismissed (PRD 1726). */
function reviewDelivery(pull: Pull, action = 'submitted'): Delivery {
  return {
    event: 'pull_request_review',
    payload: { action, installation: { id: 7 }, repository: REPOSITORY, review: { state: 'approved' }, pull_request: pull },
  };
}

function rerunDelivery(pull: Pull): Delivery {
  return {
    event: 'check_run',
    payload: {
      action: 'rerequested',
      installation: { id: 7 },
      repository: REPOSITORY,
      check_run: { head_sha: pull.head.sha, pull_requests: [{ number: pull.number, head: { sha: pull.head.sha } }] },
    },
  };
}

/** What a run of the check was handed and what it left: the budget's store, the plain calls and the log. */
type Run = { store: GithubStore; plain: string[]; logged: string[] };

/**
 * The app's installation Octokit on the stub, every call through the shared client, onto `store`.
 * Its token is minted with a plain call (the App's budget, not the installation's), recorded in `plain`.
 */
function appOctokitFor(github: GitHub, { store, plain, logged }: Run) {
  vi.stubGlobal('fetch', (url: string) => {
    plain.push(new URL(url).pathname);
    const token = { token: 'ghs_e2e', expires_at: new Date(Date.now() + HOUR).toISOString(), permissions: {}, repository_selection: 'all' };
    return Promise.resolve(new Response(JSON.stringify(token), { status: 201, headers: { 'content-type': 'application/json' } }));
  });
  return installationOctokitFor(GITHUB_APP, githubClient({ store, fetch: overHttp(github, RATE), log: (line) => logged.push(line) }));
}

const heads: string[] = [];
afterEach(() => {
  vi.unstubAllGlobals();
  for (const head of heads.splice(0)) rmSync(head, { recursive: true, force: true });
});

/** A fresh run: an empty store, no plain call, nothing logged. */
const freshRun = (): Run => ({ store: memoryGithubStore(), plain: [], logged: [] });

/** A signed delivery through `/api/github`'s unit, then every event it sent through the real function. */
async function deliver(github: GitHub, delivery: Delivery, run: Run = freshRun()) {
  const { sent, errors } = await attempt(github, delivery, run);
  expect(errors).toEqual([]);
  return sent;
}

/** `deliver`, handing back each run's error instead of failing on it. */
async function attempt(github: GitHub, { event, payload }: Delivery, run: Run) {
  const body = JSON.stringify(payload);
  const sent: AppEvent[] = [];
  const response = await receiveWebhook({
    body,
    headers: {
      'x-github-event': event,
      'x-hub-signature-256': `sha256=${createHmac('sha256', SECRET).update(body).digest('hex')}`,
    },
    secret: SECRET,
    forward: () => Promise.resolve(),
    send: (events) => Promise.resolve(sent.push(...events)),
  });
  expect(response.status).toBe(200);
  const fn = createOutboxCheck({ client: inngest, octokitFor: appOctokitFor(github, run), log: (line) => run.logged.push(line) });
  const errors: unknown[] = [];
  for (const e of sent) {
    const { error } = await new InngestTestEngine({ function: fn, events: [e] }).execute();
    if (error) errors.push(error);
  }
  return { sent, errors };
}

const featurePull = (head = 'head1') => ({
  number: parsePr(12),
  base: { ref: 'main', sha: 'base1' },
  head: { ref: 'feat/widget', sha: head },
  labels: [],
});

const latest = (github: GitHub) => checkRunAt(github.state, -1);

/** The first comment on the pull request: the test fails when there is none. */
function firstComment(github: GitHub) {
  const comment = github.state.comments[0];
  assertDefined(comment, 'a comment on the pull request');
  return comment;
}

describe('end to end — a signed webhook to a completed check', () => {
  it('1. a feature PR with an open outbox item shows the outbox check as failure, listing the item', async () => {
    const pull = featurePull();
    const github = fakeGitHub({ commits: { base1: fixture('base-active'), head1: fixture('head-open') }, pull });
    await deliver(github, pullRequestDelivery(pull));
    expect(latest(github)).toMatchObject({ name: 'outbox', head_sha: 'head1', status: 'completed', conclusion: 'failure' });
    expect(outputOf(latest(github)).title).toBe('1 open outbox item');
    expect(outputOf(latest(github)).summary).toContain('s1-01-widget-colour.md');
    expect(firstComment(github).body).toContain('Which colour should the widget be?');
  });

  it('2. after the item is settled and pushed, the same PR’s check is success', async () => {
    const github = fakeGitHub({
      commits: { base1: fixture('base-active'), head1: fixture('head-open'), head2: fixture('head-clear') },
      pull: featurePull(),
    });
    await deliver(github, pullRequestDelivery(featurePull('head1')));
    github.state.pull.head.sha = 'head2';
    await deliver(github, pullRequestDelivery(featurePull('head2')));
    expect(latest(github)).toMatchObject({ head_sha: 'head2', conclusion: 'success', output: { title: 'Outbox clear' } });
    expect(github.state.comments).toHaveLength(1);
    expect(firstComment(github).body).toContain('No open items.');
  });

  it('3. labelled omni:outbox-go while red, the check is neutral with "Override in effect"', async () => {
    const pull = { ...featurePull(), labels: ['omni:outbox-go'] };
    const github = fakeGitHub({ commits: { base1: fixture('base-active'), head1: fixture('head-open') }, pull });
    await deliver(github, pullRequestDelivery(pull, 'labeled'));
    expect(latest(github)).toMatchObject({ conclusion: 'neutral', output: { title: 'Override in effect (omni:outbox-go)' } });
  });

  it('4. a sub-PR (base is the feature branch) shows the check skipped: not active on this PR', async () => {
    const pull = { number: parsePr(13), base: { ref: 'feat/widget', sha: 'base1' }, head: { ref: 'feat/widget--s1', sha: 'head1' } };
    const github = fakeGitHub({ commits: { base1: fixture('base-active'), head1: fixture('head-open') }, pull });
    await deliver(github, pullRequestDelivery(pull, 'opened'));
    expect(latest(github)).toMatchObject({
      name: 'outbox',
      conclusion: 'skipped',
      output: { title: 'omni-loop is not active on this PR' },
    });
    expect(github.state.comments).toHaveLength(0);
  });

  it('9. a target feature PR (body "Part of <plan repo>#<prd>") passes, linking the plan PR that grades its PRD (issue 1202)', async () => {
    const pull = { ...featurePull(), head: { ref: 'feat/gadget', sha: 'head1' }, body: 'Part of acme/plan#8\n\nThe widgets half of PRD 8.' };
    const github = fakeGitHub({
      commits: { base1: fixture('base-active'), head1: fixture('head-open') },
      pull,
      others: { 'acme/plan': [{ number: 36, body: 'Closes #80' }, { number: 37, body: 'Closes #8\n\nThe plan PR.' }] },
    });
    await deliver(github, pullRequestDelivery(pull, 'opened'));
    expect(latest(github)).toMatchObject({ name: 'outbox', status: 'completed', conclusion: 'success' });
    expect(outputOf(latest(github)).title).toBe("PRD 8 is graded on acme/plan's plan PR");
    expect(outputOf(latest(github)).summary).toContain('https://github.com/acme/plan/pull/37');
    expect(github.state.comments).toHaveLength(0);
  });

  it('10. a target feature PR whose plan repository the App cannot read still passes, linking the PRD issue', async () => {
    const pull = { ...featurePull(), head: { ref: 'feat/gadget', sha: 'head1' }, body: 'Part of acme/plan#8' };
    const github = fakeGitHub({ commits: { base1: fixture('base-active'), head1: fixture('head-open') }, pull });
    await deliver(github, pullRequestDelivery(pull, 'opened'));
    expect(latest(github)).toMatchObject({ conclusion: 'success' });
    expect(outputOf(latest(github)).summary).toContain('https://github.com/acme/plan/issues/8');
  });

  it('11. a fix PR that removes a law\'s test fails, naming the law, until its folder\'s outbox answers it (PRD 1342)', async () => {
    const pull = { ...featurePull(), head: { ref: 'fix/77-crash', sha: 'head1' } };
    const files = [{ filename: 'src/widget.test.ts', status: 'removed' }];
    const github = fakeGitHub({ commits: { base1: fixture('base-laws'), head1: fixture('head-laws-fix'), head2: fixture('head-laws-fix-open') }, pull, files });
    await deliver(github, pullRequestDelivery(pull, 'opened'));
    expect(latest(github)).toMatchObject({ name: 'outbox', head_sha: 'head1', status: 'completed', conclusion: 'failure' });
    expect(outputOf(latest(github)).title).toBe('2 unaccounted changes to a law — N-PRODUCT-1');
    expect(outputOf(latest(github)).summary).toContain('.omni-loop/delivery/bugs/0077-crash/outbox/');

    github.state.pull.head.sha = 'head2';
    await deliver(github, pullRequestDelivery({ ...pull, head: { ref: 'fix/77-crash', sha: 'head2' } }));
    expect(latest(github)).toMatchObject({ head_sha: 'head2', conclusion: 'failure', output: { title: '1 open outbox item — N-PRODUCT-1' } });
    expect(firstComment(github).body).toContain('The fix removes the old test');
  });

  it('12. a fix PR that touches no law passes, and a knowledge PR passes listing its laws (PRD 1342)', async () => {
    const fix = { ...featurePull(), head: { ref: 'fix/77-crash', sha: 'head1' } };
    const clear = fakeGitHub({ commits: { base1: fixture('base-laws'), head1: fixture('head-laws-fix') }, pull: fix, files: [{ filename: 'src/widget.ts', status: 'modified' }] });
    await deliver(clear, pullRequestDelivery(fix, 'opened'));
    expect(latest(clear)).toMatchObject({ conclusion: 'success', output: { title: 'Outbox clear' } });

    const knowledge = { ...featurePull(), head: { ref: 'docs/knowledge-widget', sha: 'head1' } };
    const files = [{ filename: '.omni-loop/knowledge/product/invariants.md', status: 'modified' }];
    const github = fakeGitHub({ commits: { base1: fixture('base-laws'), head1: fixture('head-laws-feature-demoted') }, pull: knowledge, files });
    await deliver(github, pullRequestDelivery(knowledge, 'opened'));
    expect(latest(github)).toMatchObject({ conclusion: 'success', output: { title: 'Knowledge PR: 1 law touched' } });
    expect(outputOf(latest(github)).summary).toContain('N-PRODUCT-1: A widget is never shown without its colour.');
  });

  describe('13. a change to a locked law waits for its CODEOWNER’s approval on GitHub (PRD 1726)', () => {
    const LAW_TITLE = "Locked law changed without its CODEOWNER's approval — N-PRODUCT-1";
    const INVARIANTS = '.omni-loop/knowledge/product/invariants.md';
    const knowledgePull = () => ({ ...featurePull(), head: { ref: 'docs/knowledge-widget', sha: 'head1' } });
    const review = (login: string, state = 'APPROVED', commit = 'head1') => ({ user: { login }, state, commit_id: commit });
    /** A knowledge PR rewording the locked N-PRODUCT-1, on a base whose CODEOWNERS gives it to @ann. */
    const knowledgeGitHub = (reviews: ReturnType<typeof review>[] = [], base = 'base-locked') =>
      fakeGitHub({
        commits: { base1: fixture(base), head1: fixture('head-locked-edited') },
        pull: knowledgePull(),
        files: [{ filename: INVARIANTS, status: 'modified' }],
        reviews,
      });

    it('no approval: a knowledge PR, never blocked before, is red, naming the law and its owner', async () => {
      const github = knowledgeGitHub();
      await deliver(github, pullRequestDelivery(knowledgePull(), 'opened'));
      expect(latest(github)).toMatchObject({ name: 'outbox', conclusion: 'failure', output: { title: LAW_TITLE } });
      expect(outputOf(latest(github)).summary).toContain(`N-PRODUCT-1: waiting for an approving review of the head commit from @ann, who own \`${INVARIANTS}\`.`);
      expect(outputOf(latest(github)).summary).toContain('Knowledge PR: never blocked.');
    });

    it('a non-owner’s approval, an owner’s comment, or an owner’s approval of an older commit leaves it red', async () => {
      const github = knowledgeGitHub([review('bob'), review('ann', 'COMMENTED'), review('ann', 'APPROVED', 'head0')]);
      await deliver(github, pullRequestDelivery(knowledgePull(), 'opened'));
      expect(latest(github)).toMatchObject({ conclusion: 'failure', output: { title: LAW_TITLE } });
    });

    it('a CODEOWNER’s approval, read from the base, turns it green on the review alone, and a dismissal red again', async () => {
      const github = knowledgeGitHub();
      await deliver(github, pullRequestDelivery(knowledgePull(), 'opened'));
      expect(latest(github)).toMatchObject({ conclusion: 'failure' });

      github.state.reviews.push(review('ann'));
      const sent = await deliver(github, reviewDelivery(knowledgePull(), 'submitted'));
      expect(sent).toHaveLength(1);
      expect(latest(github)).toMatchObject({ head_sha: 'head1', conclusion: 'success', output: { title: 'Knowledge PR: 1 law touched' } });
      expect(outputOf(latest(github)).summary).toContain('Locked laws changed (N-PRODUCT-1): approved by their CODEOWNERS, @ann.');
      const githubFolders = github.state.requests.map((r) => String(r.tree_sha)).filter((sha) => sha.endsWith(':.github'));
      expect(githubFolders.length).toBeGreaterThan(0);
      expect(githubFolders.every((sha) => sha === 'base1:.github')).toBe(true);

      github.state.reviews.push(review('ann', 'DISMISSED'));
      await deliver(github, reviewDelivery(knowledgePull(), 'dismissed'));
      expect(latest(github)).toMatchObject({ conclusion: 'failure', output: { title: LAW_TITLE } });
    });

    it('no CODEOWNERS on the base: red, naming the law, whoever approved', async () => {
      const github = knowledgeGitHub([review('ann')], 'base-locked-unowned');
      await deliver(github, pullRequestDelivery(knowledgePull(), 'opened'));
      expect(latest(github)).toMatchObject({ conclusion: 'failure', output: { title: LAW_TITLE } });
      expect(outputOf(latest(github)).summary).toContain('N-PRODUCT-1: no CODEOWNERS file owns');
    });

    it('an enforce PR that changes a locked law’s test is red until its owner approves', async () => {
      const pull = { ...featurePull(), head: { ref: 'test/law-N-PRODUCT-1', sha: 'head1' } };
      const files = [{ filename: 'src/widget.test.ts', status: 'modified' }];
      const github = fakeGitHub({ commits: { base1: fixture('base-locked'), head1: fixture('base-locked') }, pull, files });
      await deliver(github, pullRequestDelivery(pull, 'opened'));
      expect(latest(github)).toMatchObject({ conclusion: 'failure', output: { title: LAW_TITLE } });
      expect(outputOf(latest(github)).summary).toContain('who own `src/widget.test.ts`');

      github.state.reviews.push(review('ann'));
      await deliver(github, reviewDelivery(pull));
      expect(latest(github)).toMatchObject({ conclusion: 'success' });
    });

    it('the omni:outbox-go label does not clear it: a feature PR stays red, never neutral', async () => {
      const pull = { ...featurePull(), labels: ['omni:outbox-go'] };
      const files = [{ filename: INVARIANTS, status: 'modified' }];
      const github = fakeGitHub({ commits: { base1: fixture('base-locked'), head1: fixture('head-locked-edited') }, pull, files });
      await deliver(github, pullRequestDelivery(pull, 'labeled'));
      expect(latest(github)).toMatchObject({ conclusion: 'failure', output: { title: LAW_TITLE } });
      expect(outputOf(latest(github)).summary).toContain('no outbox item, label or trailer does');
    });

    it('a rule’s test change still needs a high item, as before, and nothing more', async () => {
      const pull = { ...featurePull(), head: { ref: 'fix/77-crash', sha: 'head1' } };
      const files = [{ filename: 'src/name.test.ts', status: 'modified' }];
      const github = fakeGitHub({ commits: { base1: fixture('base-locked'), head1: fixture('base-locked') }, pull, files });
      await deliver(github, pullRequestDelivery(pull, 'opened'));
      expect(latest(github)).toMatchObject({ conclusion: 'failure', output: { title: '1 unaccounted change to a law — N-PRODUCT-2' } });
      expect(github.state.requests.map((r) => r.route)).not.toContain('GET /repos/{owner}/{repo}/pulls/{pull_number}/reviews');
    });
  });

  describe('14. a change to the briefing needs an item ranked high a person answers (PRD 1793)', () => {
    const BRIEFING = '.omni-loop/knowledge/playbook/briefing.md';
    const OUTBOX = '.omni-loop/delivery/outbox/0042-widget';
    const ITEM = `${OUTBOX}/s1-01-widget-colour.md`;
    const files = [{ filename: BRIEFING, status: 'modified' }];
    const itemOf = (rank: string) => readFileSync(join(fixture('head-open'), ITEM), 'utf8').replace('rank: high', `rank: ${rank}`);

    /** A head built at run time from `head-clear` and the base's knowledge: the briefing changed, an account naming the item, and `prepare` on the kit's context. */
    function headWith(prepare: (ctx: ReturnType<typeof createContext>) => void) {
      const head = mkdtempSync(join(tmpdir(), 'e2e-briefing-'));
      heads.push(head);
      cpSync(fixture('head-clear'), head, { recursive: true });
      cpSync(join(fixture('base-laws'), '.omni-loop/knowledge'), join(head, '.omni-loop/knowledge'), { recursive: true });
      const write = (path: string, text: string) => {
        mkdirSync(dirname(join(head, path)), { recursive: true });
        writeFileSync(join(head, path), text);
      };
      write(BRIEFING, '---\nform: briefing\nform-version: 1\nstate: filled\npoints-to: null\nevidence: []\ninvaded: null\n---\n\n# Briefing\n');
      write(`${OUTBOX}/accounts/s1.md`, ['---', 'prd: 42', 'slice: s1', 'graded: 2026-10-15', '---', '', '## Risky changes', '', `- \`${BRIEFING}\``, 'briefing-text', 'item s1-01-widget-colour', ''].join('\n'));
      prepare(createContext(head, parseConfig(readFileSync(join(fixture('base-laws'), '.omni-loop/config.yml'), 'utf8'))));
      return head;
    }

    it('a feature PR whose account names a medium item fails, saying the briefing needs an item ranked high', async () => {
      const head = headWith((ctx) => {
        expect(adoptItem({ ctx, itemText: itemOf('medium') }).ok).toBe(true);
      });
      const pull = featurePull();
      const github = fakeGitHub({ commits: { base1: fixture('base-laws'), head1: head }, pull, files });
      await deliver(github, pullRequestDelivery(pull, 'opened'));
      expect(latest(github)).toMatchObject({ name: 'outbox', conclusion: 'failure' });
      expect(outputOf(latest(github)).summary).toContain(`${BRIEFING} (briefing-text) — its account names item s1-01-widget-colour, ranked medium: a change to the briefing needs an item ranked high`);
    });

    it('a feature PR whose high item a person answered succeeds', async () => {
      const head = headWith((ctx) => {
        writeFileSync(join(ctx.root, ITEM), itemOf('high'));
        const answer = { text: 'Yes, keep it.', approvedBy: 'pierrederval', approvedAt: '2026-10-15', channel: { kind: 'feature-pull-request', number: 12 }, statedVerdict: 'agreed' };
        expect(settleItem({ ctx, file: ITEM, answer }).ok).toBe(true);
      });
      const pull = featurePull();
      const github = fakeGitHub({ commits: { base1: fixture('base-laws'), head1: head }, pull, files });
      await deliver(github, pullRequestDelivery(pull, 'opened'));
      expect(latest(github)).toMatchObject({ name: 'outbox', conclusion: 'success', output: { title: 'Outbox clear' } });
    });

    it('a knowledge PR changing the briefing succeeds', async () => {
      const pull = { ...featurePull(), head: { ref: 'docs/knowledge-widget', sha: 'head1' } };
      const github = fakeGitHub({ commits: { base1: fixture('base-laws'), head1: fixture('head-laws-fix') }, pull, files });
      await deliver(github, pullRequestDelivery(pull, 'opened'));
      expect(latest(github)).toMatchObject({ conclusion: 'success', output: { title: 'Knowledge PR: no law touched' } });
    });
  });

  it('15. the escalation record leaves the check as it was: the same conclusion and summary with and without it (PRD 1794)', async () => {
    const delegated = commitOf([fixture('base-locked')], (yaml) => yaml.replace('  owners: [ann]', '  owners:\n    - login: ann\n      delegate: jdoe\n  leadership: [cto]'));
    const head = commitOf([fixture('head-locked-edited'), fixture('head-open')]);
    try {
      const files = [{ filename: '.omni-loop/knowledge/product/invariants.md', status: 'modified' }];
      const checked = async (base: string) => {
        const github = fakeGitHub({ commits: { base1: base, head1: head }, pull: featurePull(), files });
        await deliver(github, pullRequestDelivery(featurePull()));
        const run = latest(github);
        return { github, check: { conclusion: run.conclusion, ...outputOf(run) } };
      };
      const withRecord = await checked(delegated);
      const without = await checked(fixture('base-locked'));
      expect(withRecord.github.state.comments.filter((comment) => comment.body.startsWith(RECORD_MARKER))).toHaveLength(1);
      expect(without.github.state.comments.filter((comment) => comment.body.startsWith(RECORD_MARKER))).toEqual([]);
      expect(withRecord.check).toEqual(without.check);
      expect(withRecord.check.conclusion).toBe('failure');
    } finally {
      rmSync(delegated, { recursive: true, force: true });
      rmSync(head, { recursive: true, force: true });
    }
  });

  it('5. a repository with no .omni-loop/config.yml gets no outbox check at all (PRD 359)', async () => {
    const pull = featurePull();
    const github = fakeGitHub({ commits: { base1: fixture('base-inactive'), head1: fixture('head-open') }, pull });
    await deliver(github, pullRequestDelivery(pull, 'opened'));
    await deliver(github, rerunDelivery(pull));
    expect(github.state.checkRuns).toEqual([]);
    expect(github.state.comments).toEqual([]);
    const routes = github.state.requests.map((r) => r.route);
    expect(routes.filter((route) => route.includes('check-runs') || route.includes('/comments'))).toEqual([]);
    expect(routes).not.toContain('GET /repos/{owner}/{repo}/compare/{basehead}');
  });

  it('6. pressing Re-run re-evaluates without a new commit', async () => {
    const pull = featurePull();
    const github = fakeGitHub({ commits: { base1: fixture('base-active'), head1: fixture('head-open') }, pull });
    await deliver(github, pullRequestDelivery(pull));
    github.state.pull.labels = ['omni:outbox-go'];
    const sent = await deliver(github, rerunDelivery(pull));
    expect(sent).toHaveLength(1);
    expect(github.state.checkRuns).toHaveLength(2);
    expect(latest(github)).toMatchObject({ head_sha: 'head1', conclusion: 'neutral' });
  });

  it('7. every call the check makes goes through the shared client, spending the installation’s budget', async () => {
    const pull = featurePull();
    const github = fakeGitHub({ commits: { base1: fixture('base-active'), head1: fixture('head-open') }, pull });
    const run = freshRun();
    await deliver(github, pullRequestDelivery(pull), run);
    expect(github.state.requests.length).toBeGreaterThan(0);
    expect(await run.store.budget(INSTALLATION, 'core')).toMatchObject({ limit: 5000, remaining: 4900, pausedUntil: null });
    expect(run.plain).toEqual([`/app/installations/${INSTALLATION}/access_tokens`]);
  });

  it('8. a paused budget refuses the check: nothing is sent to GitHub, nothing is posted, one line is logged', async () => {
    const pull = featurePull();
    const github = fakeGitHub({ commits: { base1: fixture('base-active'), head1: fixture('head-open') }, pull });
    const run = freshRun();
    const until = Date.now() + HOUR;
    await run.store.pause(INSTALLATION, 'core', until, Date.now());
    const { errors } = await attempt(github, pullRequestDelivery(pull), run);
    expect(errors).toHaveLength(1);
    expect(github.state.requests).toEqual([]);
    expect(github.state.checkRuns).toEqual([]);
    expect(github.state.comments).toEqual([]);
    expect(run.logged).toEqual([expect.stringContaining(`GitHub paused until ${new Date(until).toISOString()}`)]);
  });
});
