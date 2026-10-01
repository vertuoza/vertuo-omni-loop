import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { InngestTestEngine } from '@inngest/test';
import { describe, expect, it } from 'vitest';
import { inngest, OUTBOX_CHECK_EVENT } from '../inngest-client.mjs';
import { fakeGitHub } from './fake-github.mjs';
import { startCheck } from '../publish/publish.mjs';
import { DEBOUNCE, FUNCTION_ID, createFailureHandler, createOutboxCheck, outboxCheck } from './outbox-check.mjs';

const FIXTURES = fileURLToPath(new URL('../../test/fixtures/', import.meta.url));
const fixture = (name) => join(FIXTURES, name);

const event = (over = {}) => ({
  name: OUTBOX_CHECK_EVENT,
  data: {
    installationId: 7,
    owner: 'acme',
    repo: 'widgets',
    repository: 'acme/widgets',
    prNumber: 12,
    headSha: 'head1',
    trigger: 'pull_request.synchronize',
    ...over,
  },
});

function featureGitHub(over = {}) {
  return fakeGitHub({
    commits: { base1: fixture('base-active'), head1: fixture('head-open') },
    pull: { number: 12, base: { ref: 'main', sha: 'base1' }, head: { ref: 'feat/widget', sha: 'head1' } },
    ...over,
  });
}

function engine(github) {
  const fn = createOutboxCheck({ client: inngest, octokitFor: () => github.octokit });
  return new InngestTestEngine({ function: fn, events: [event()] });
}

describe('outbox-check — the three steps', () => {
  it('runs in-progress, then evaluate, then publish, in that order', async () => {
    const github = featureGitHub();
    const { ctx, result } = await engine(github).execute();
    const ids = ctx.step.run.mock.calls.map(([id]) => id);
    expect(ids).toEqual(['in-progress', 'evaluate', 'publish']);
    expect(result).toMatchObject({ conclusion: 'failure', name: 'outbox', comment: 'created' });
  });

  it('creates the check in progress before anything is evaluated, then completes that same run', async () => {
    const github = featureGitHub();
    await engine(github).execute();
    const writes = github.state.requests.filter((r) => r.route.includes('check-runs'));
    expect(writes.map((r) => [r.route, r.status])).toEqual([
      ['POST /repos/{owner}/{repo}/check-runs', 'in_progress'],
      ['PATCH /repos/{owner}/{repo}/check-runs/{check_run_id}', 'completed'],
    ]);
    expect(github.state.checkRuns).toHaveLength(1);
    expect(github.state.checkRuns[0]).toMatchObject({ head_sha: 'head1', status: 'completed', conclusion: 'failure' });
  });

  it('snapshots only the base config and the head delivery folder', async () => {
    const github = featureGitHub();
    await engine(github).execute();
    const blobs = github.state.requests
      .filter((r) => r.route === 'GET /repos/{owner}/{repo}/git/blobs/{file_sha}')
      .map((r) => r.file_sha);
    expect(blobs.length).toBeGreaterThan(0);
    for (const sha of blobs) {
      expect(sha === 'base1:.omni-loop/config.yml' || sha.startsWith('head1:.omni-loop/delivery/')).toBe(true);
    }
  });

  it('hands the changed files from the compare endpoint to the gate', async () => {
    const github = featureGitHub();
    await engine(github).execute();
    const compare = github.state.requests.find((r) => r.route === 'GET /repos/{owner}/{repo}/compare/{basehead}');
    expect(compare.basehead).toBe('base1...head1');
  });
});

describe('outbox-check — silent where the loop is not installed (PRD 359)', () => {
  const inactiveGitHub = () => featureGitHub({ commits: { base1: fixture('base-inactive'), head1: fixture('head-open') } });

  it('a pull request on a repository without .omni-loop posts no check and no comment', async () => {
    const github = inactiveGitHub();
    const { ctx, result } = await engine(github).execute();
    expect(ctx.step.run.mock.calls.map(([id]) => id)).toEqual(['in-progress']);
    expect(result).toEqual({ posted: false, reason: 'omni-loop is not active on this repo' });
    expect(github.state.checkRuns).toEqual([]);
    expect(github.state.comments).toEqual([]);
    const writes = github.state.requests.filter((r) => r.route.startsWith('POST ') || r.route.startsWith('PATCH '));
    expect(writes).toEqual([]);
  });

  it('a broken config still gets its check: omni-loop is installed there, and says what is wrong', async () => {
    const github = featureGitHub({ commits: { base1: fixture('base-broken'), head1: fixture('head-open') } });
    await engine(github).execute();
    expect(github.state.checkRuns).toHaveLength(1);
    expect(github.state.checkRuns[0]).toMatchObject({ status: 'completed', conclusion: 'failure' });
  });

  it('the failure handler posts nothing either on a repository without .omni-loop', async () => {
    const github = inactiveGitHub();
    const handler = createFailureHandler({ octokitFor: () => github.octokit });
    const out = await handler({
      event: { name: 'inngest/function.failed', data: { event: event(), error: { message: 'boom' } } },
      error: new Error('boom'),
    });
    expect(out).toEqual({ posted: false, reason: 'omni-loop is not active on this repo' });
    expect(github.state.checkRuns).toEqual([]);
  });
});

describe('outbox-check — the function’s configuration', () => {
  it('is triggered by the event /api/github sends', () => {
    expect(outboxCheck.id()).toBe(FUNCTION_ID);
    expect(outboxCheck.opts.triggers).toEqual([{ event: OUTBOX_CHECK_EVENT }]);
  });

  it('debounces per repository and pull request number', () => {
    expect(outboxCheck.opts.debounce).toBe(DEBOUNCE);
    expect(DEBOUNCE.key).toContain('event.data.repository');
    expect(DEBOUNCE.key).toContain('event.data.prNumber');
    expect(DEBOUNCE.period).toMatch(/^\d+s$/);
  });

  it('has a failure handler', () => {
    expect(typeof outboxCheck.opts.onFailure).toBe('function');
  });
});

describe('outbox-check — fail closed', () => {
  it('a thrown step fails the run (and Inngest then calls the failure handler)', async () => {
    const github = featureGitHub();
    const broken = { request: async (route, params) => {
      if (route === 'GET /repos/{owner}/{repo}/compare/{basehead}') throw new Error('GitHub is down');
      return github.octokit.request(route, params);
    } };
    const fn = createOutboxCheck({ client: inngest, octokitFor: () => broken });
    const { error } = await new InngestTestEngine({ function: fn, events: [event()] }).execute();
    expect(error).toBeTruthy();
    expect(github.state.checkRuns[0].status).toBe('in_progress');

    const handler = createFailureHandler({ octokitFor: () => github.octokit });
    await handler({
      event: { name: 'inngest/function.failed', data: { event: event(), error: { message: 'GitHub is down' } } },
      error: new Error('GitHub is down'),
    });
    expect(github.state.checkRuns).toHaveLength(1);
    expect(github.state.checkRuns[0]).toMatchObject({
      status: 'completed',
      conclusion: 'failure',
      output: { title: 'omni-loop could not evaluate: GitHub is down' },
    });
  });

  it('creates the check already failed when the run failed before creating one', async () => {
    const github = featureGitHub();
    const handler = createFailureHandler({ octokitFor: () => github.octokit });
    await handler({
      event: { name: 'inngest/function.failed', data: { event: event(), error: { message: 'boom\nstack' } } },
      error: new Error('boom\nstack'),
    });
    expect(github.state.checkRuns).toEqual([
      expect.objectContaining({
        name: 'outbox',
        head_sha: 'head1',
        status: 'completed',
        conclusion: 'failure',
        output: expect.objectContaining({ title: 'omni-loop could not evaluate: boom' }),
      }),
    ]);
  });

  it('falls back to the default check name when GitHub cannot be read, failing the check already started', async () => {
    const github = featureGitHub();
    await startCheck(github.octokit, { owner: 'acme', repo: 'widgets', headSha: 'head1', name: 'outbox' });
    const flaky = { request: async (route, params) => {
      if (route === 'GET /repos/{owner}/{repo}/pulls/{pull_number}') throw new Error('502');
      return github.octokit.request(route, params);
    } };
    const handler = createFailureHandler({ octokitFor: () => flaky });
    const out = await handler({
      event: { name: 'inngest/function.failed', data: { event: event(), error: { message: '502' } } },
      error: new Error('502'),
    });
    expect(out.name).toBe('outbox');
    expect(github.state.checkRuns[0].conclusion).toBe('failure');
  });

  it('does not retry a snapshot over its bound, and names the bound', async () => {
    const github = featureGitHub();
    const huge = { request: async (route, params) => {
      const response = await github.octokit.request(route, params);
      if (route.endsWith('/git/trees/{tree_sha}') && params.recursive === '1' && params.tree_sha.startsWith('head1')) {
        const many = Array.from({ length: 2001 }, (_, i) => ({ path: `f${i}.md`, mode: '100644', type: 'blob', sha: `x${i}`, size: 1 }));
        return { data: { ...response.data, tree: many } };
      }
      return response;
    } };
    const fn = createOutboxCheck({ client: inngest, octokitFor: () => huge });
    const { error } = await new InngestTestEngine({ function: fn, events: [event()] }).execute();
    expect(error?.name).toBe('NonRetriableError');
    expect(error?.message).toMatch(/over the bound of 2,000 files/);
  });
});

describe('outbox-check — only an Omni Loop feature PR is gated (issue 876)', () => {
  const failed = (message) => ({
    event: { name: 'inngest/function.failed', data: { event: event(), error: { message } } },
    error: new Error(message),
  });
  const RATE_LIMIT = 'API rate limit exceeded for installation ID 7.';
  const dependabotPr = { number: 12, base: { ref: 'main', sha: 'base1' }, head: { ref: 'dependabot/npm_and_yarn/brace-expansion-5.0.12', sha: 'head1' } };
  const plainFeaturePr = { number: 12, base: { ref: 'main', sha: 'base1' }, head: { ref: 'feat/VS-29444-gantt-node-move-dates', sha: 'head1' } };

  /** A GitHub that rate-limits every read past the pull request and the base config, as on vertuo-backend-php#6333. */
  function rateLimitedAfterClassify(github) {
    return { request: async (route, params) => {
      if (route === 'GET /repos/{owner}/{repo}/compare/{basehead}') throw new Error(RATE_LIMIT);
      if (route === 'GET /repos/{owner}/{repo}/issues/{issue_number}/comments') throw new Error(RATE_LIMIT);
      return github.octokit.request(route, params);
    } };
  }

  for (const [kind, pull] of [['a dependabot PR', dependabotPr], ['a plain feature PR', plainFeaturePr]]) {
    it(`${kind}: one check, completed skipped, before any gate read`, async () => {
      const github = featureGitHub({ pull });
      const { result } = await engine(github).execute();
      expect(result).toMatchObject({ conclusion: 'skipped' });
      expect(github.state.checkRuns).toEqual([
        expect.objectContaining({ name: 'outbox', head_sha: 'head1', status: 'completed', conclusion: 'skipped' }),
      ]);
      const reads = github.state.requests.map((r) => r.route);
      expect(reads).not.toContain('GET /repos/{owner}/{repo}/compare/{basehead}');
      expect(reads).not.toContain('GET /repos/{owner}/{repo}/issues/{issue_number}/comments');
    });

    it(`${kind}: a run GitHub rate-limits never ends red`, async () => {
      const github = featureGitHub({ pull });
      const limited = rateLimitedAfterClassify(github);
      const fn = createOutboxCheck({ client: inngest, octokitFor: () => limited });
      await new InngestTestEngine({ function: fn, events: [event()] }).execute();
      await createFailureHandler({ octokitFor: () => github.octokit })(failed(RATE_LIMIT));
      expect(github.state.checkRuns.map((r) => r.conclusion)).not.toContain('failure');
      expect(github.state.checkRuns.map((r) => r.status)).not.toContain('in_progress');
    });

    it(`${kind}: the failure handler, run with no check yet, posts skipped — never failure`, async () => {
      const github = featureGitHub({ pull });
      await createFailureHandler({ octokitFor: () => github.octokit })(failed(RATE_LIMIT));
      expect(github.state.checkRuns).toEqual([
        expect.objectContaining({ status: 'completed', conclusion: 'skipped' }),
      ]);
    });

    it(`${kind}: a re-synchronize keeps it skipped`, async () => {
      const github = featureGitHub({ pull });
      await engine(github).execute();
      github.state.pull.head.sha = 'head1';
      const again = createOutboxCheck({ client: inngest, octokitFor: () => github.octokit });
      await new InngestTestEngine({ function: again, events: [event({ trigger: 'pull_request.synchronize' })] }).execute();
      expect(github.state.checkRuns.map((r) => r.conclusion)).toEqual(['skipped', 'skipped']);
    });
  }

  it('the failure handler posts nothing when it cannot tell what the pull request is', async () => {
    const github = featureGitHub({ pull: dependabotPr });
    const down = { request: async (route, params) => {
      if (route.startsWith('GET ')) throw new Error(RATE_LIMIT);
      return github.octokit.request(route, params);
    } };
    const out = await createFailureHandler({ octokitFor: () => down })(failed(RATE_LIMIT));
    expect(out).toMatchObject({ posted: false });
    expect(github.state.checkRuns).toEqual([]);
  });

  it('an Omni Loop feature PR GitHub rate-limits still fails closed', async () => {
    const github = featureGitHub();
    const limited = rateLimitedAfterClassify(github);
    const fn = createOutboxCheck({ client: inngest, octokitFor: () => limited });
    await new InngestTestEngine({ function: fn, events: [event()] }).execute();
    await createFailureHandler({ octokitFor: () => github.octokit })(failed(RATE_LIMIT));
    expect(github.state.checkRuns).toEqual([
      expect.objectContaining({ status: 'completed', conclusion: 'failure' }),
    ]);
  });

  it('an Omni Loop feature PR with an open outbox item is still red', async () => {
    const github = featureGitHub();
    const { result } = await engine(github).execute();
    expect(result).toMatchObject({ conclusion: 'failure' });
  });
});
