// The outbox check through its job of the ledger (PRD 2688 s7: the Inngest function is gone, the `pr-outbox`
// job runs the same body), against the stubbed GitHub. The two laws this file proves hold through the job.
import { parsePr } from 'omni-loop/kit/lib/ids.ts';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { assertDefined } from 'omni-loop/kit/test/assert.ts';
import { checkRunAt, claimedJob, fakeGitHub } from './fake-github.ts';
import { startCheck } from '../publish/publish.ts';
import { OUTBOX_KIND, outboxFailureHook, outboxHandler } from './job.ts';
import type { GitHubClient } from './github.ts';

const FIXTURES = fileURLToPath(new URL('../../test/fixtures/', import.meta.url));
const fixture = (name: string) => join(FIXTURES, name);

/** A request's parameters, as a unit hands them to `octokit.request`. */
type Params = Record<string, unknown>;

/** A tree GitHub answered, as far as the bound's test reads it. */
const TreeAnswerSchema = z.looseObject({ data: z.looseObject({}) });

const payload = (over = {}) => ({
  installationId: 7,
  owner: 'acme',
  repo: 'widgets',
  repository: 'acme/widgets',
  prNumber: 12,
  headSha: 'head1',
  trigger: 'pull_request.synchronize',
  ...over,
});

const quiet = () => undefined;

function featureGitHub(over = {}) {
  return fakeGitHub({
    commits: { base1: fixture('base-active'), head1: fixture('head-open') },
    pull: { number: parsePr(12), base: { ref: 'main', sha: 'base1' }, head: { ref: 'feat/widget', sha: 'head1' } },
    ...over,
  });
}

/** One try of the `pr-outbox` job over `octokit`: how it ended, or what it threw. */
async function run(octokit: GitHubClient) {
  try {
    return { result: await outboxHandler({ octokitFor: () => octokit, log: quiet })(claimedJob(OUTBOX_KIND, payload())), error: undefined };
  } catch (error) {
    return { result: undefined, error };
  }
}

/** The job's failure hook over `octokit`, the job having failed on its 5th try with `reason`. */
const failed = (octokit: GitHubClient, reason: string) => outboxFailureHook({ octokitFor: () => octokit, log: quiet })(claimedJob(OUTBOX_KIND, payload(), 5), reason);

describe('outbox-check — the three steps, in one try of the job', () => {
  it('creates the check in progress before anything is evaluated, then completes that same run', async () => {
    const github = featureGitHub();
    expect((await run(github.octokit)).result).toEqual({ outcome: 'done' });
    const routes = github.state.requests.map((r) => r.route);
    expect(routes.indexOf('POST /repos/{owner}/{repo}/check-runs')).toBeLessThan(routes.indexOf('GET /repos/{owner}/{repo}/compare/{basehead}'));
    const writes = github.state.requests.filter((r) => r.route.includes('check-runs'));
    expect(writes.map((r) => [r.route, r.status])).toEqual([
      ['POST /repos/{owner}/{repo}/check-runs', 'in_progress'],
      ['PATCH /repos/{owner}/{repo}/check-runs/{check_run_id}', 'completed'],
    ]);
    expect(github.state.checkRuns).toHaveLength(1);
    expect(github.state.checkRuns[0]).toMatchObject({ name: 'outbox', head_sha: 'head1', status: 'completed', conclusion: 'failure' });
    expect(github.state.comments).toHaveLength(1);
  });

  it('snapshots only the base config and the head delivery folder', async () => {
    const github = featureGitHub();
    await run(github.octokit);
    const blobs = github.state.requests
      .filter((r) => r.route === 'GET /repos/{owner}/{repo}/git/blobs/{file_sha}')
      .map((r) => String(r.file_sha));
    expect(blobs.length).toBeGreaterThan(0);
    for (const sha of blobs) {
      expect(sha === 'base1:.omni-loop/config.yml' || sha.startsWith('head1:.omni-loop/delivery/')).toBe(true);
    }
  });

  it('with laws in the knowledge folder, also snapshots it at the base and at the head (PRD 1342)', async () => {
    const github = featureGitHub({ commits: { base1: fixture('base-laws'), head1: fixture('head-laws-feature-demoted') } });
    await run(github.octokit);
    const blobs = github.state.requests
      .filter((r) => r.route === 'GET /repos/{owner}/{repo}/git/blobs/{file_sha}')
      .map((r) => String(r.file_sha));
    expect(blobs).toContain('base1:.omni-loop/knowledge/product/invariants.md');
    expect(blobs).toContain('head1:.omni-loop/knowledge/product/invariants.md');
    for (const sha of blobs) {
      expect(/^base1:\.omni-loop\/(config\.yml|knowledge\/)|^head1:\.omni-loop\/(delivery|knowledge)\//.test(sha)).toBe(true);
    }
  });

  it('hands the changed files from the compare endpoint to the gate', async () => {
    const github = featureGitHub();
    await run(github.octokit);
    const compare = github.state.requests.find((r) => r.route === 'GET /repos/{owner}/{repo}/compare/{basehead}');
    assertDefined(compare, 'the compare request');
    expect(compare.basehead).toBe('base1...head1');
  });

  // Law N-PRODUCT-4 (.omni-loop/knowledge/product/invariants.md, #1540).
  it('law N-PRODUCT-4: the gate takes its rules from the base, and from the head reads only the delivery and knowledge folders', async () => {
    const blobsOf = (github: ReturnType<typeof featureGitHub>) =>
      github.state.requests.filter((r) => r.route === 'GET /repos/{owner}/{repo}/git/blobs/{file_sha}').map((r) => String(r.file_sha));
    const pull = (labels: string[]) => ({ number: parsePr(12), base: { ref: 'main', sha: 'base1' }, head: { ref: 'feat/widget', sha: 'head1' }, labels });

    // The head renames the override label to `ship-it`: that label overrides nothing, the base's still does.
    const renamed = featureGitHub({ commits: { base1: fixture('base-active'), head1: fixture('head-renames-label') }, pull: pull(['ship-it']) });
    await run(renamed.octokit);
    expect(renamed.state.checkRuns[0]).toMatchObject({ status: 'completed', conclusion: 'failure' });
    const base = featureGitHub({ commits: { base1: fixture('base-active'), head1: fixture('head-renames-label') }, pull: pull(['omni:outbox-go']) });
    await run(base.octokit);
    expect(base.state.checkRuns[0]).toMatchObject({ status: 'completed', conclusion: 'neutral' });

    // From the head, only what is judged: the delivery folder, and the knowledge folder beside the base's.
    const laws = featureGitHub({ commits: { base1: fixture('base-laws'), head1: fixture('head-laws-feature-demoted') } });
    await run(laws.octokit);
    const blobs = [...blobsOf(renamed), ...blobsOf(laws)];
    expect(blobs).toContain('base1:.omni-loop/config.yml');
    expect(blobs).toContain('base1:.omni-loop/knowledge/product/invariants.md');
    expect(blobs).toContain('head1:.omni-loop/knowledge/product/invariants.md');
    for (const sha of blobs.filter((s) => s.startsWith('head1:'))) {
      expect(sha).toMatch(/^head1:\.omni-loop\/(delivery|knowledge)\//);
    }
  });
});

describe('outbox-check — silent where the loop is not installed (PRD 359)', () => {
  const inactiveGitHub = () => featureGitHub({ commits: { base1: fixture('base-inactive'), head1: fixture('head-open') } });

  it('a pull request on a repository without .omni-loop posts no check and no comment, and the job ends skipped', async () => {
    const github = inactiveGitHub();
    expect((await run(github.octokit)).result).toEqual({ outcome: 'skipped', reason: 'omni-loop is not active on this repo' });
    expect(github.state.checkRuns).toEqual([]);
    expect(github.state.comments).toEqual([]);
    const writes = github.state.requests.filter((r) => r.route.startsWith('POST ') || r.route.startsWith('PATCH '));
    expect(writes).toEqual([]);
  });

  it('a broken config still gets its check: omni-loop is installed there, and says what is wrong', async () => {
    const github = featureGitHub({ commits: { base1: fixture('base-broken'), head1: fixture('head-open') } });
    await run(github.octokit);
    expect(github.state.checkRuns).toHaveLength(1);
    expect(github.state.checkRuns[0]).toMatchObject({ status: 'completed', conclusion: 'failure' });
  });

  it('the failure hook posts nothing either on a repository without .omni-loop', async () => {
    const github = inactiveGitHub();
    await failed(github.octokit, 'boom');
    expect(github.state.checkRuns).toEqual([]);
  });
});

describe('outbox-check — fail closed', () => {
  it('a try that throws leaves the check in progress, and the failure hook then completes it as failure', async () => {
    const github = featureGitHub();
    const broken = { request: (route: string, params?: Params) => {
      if (route === 'GET /repos/{owner}/{repo}/compare/{basehead}') return Promise.reject(new Error('GitHub is down'));
      return github.octokit.request(route, params);
    } };
    expect((await run(broken)).error).toBeTruthy();
    expect(checkRunAt(github.state, 0).status).toBe('in_progress');

    await failed(github.octokit, 'GitHub is down');
    expect(github.state.checkRuns).toHaveLength(1);
    expect(github.state.checkRuns[0]).toMatchObject({
      status: 'completed',
      conclusion: 'failure',
      output: { title: 'omni-loop could not evaluate: GitHub is down' },
    });
  });

  it('creates the check already failed when the job failed before creating one', async () => {
    const github = featureGitHub();
    await failed(github.octokit, 'boom\nstack');
    expect(github.state.checkRuns).toHaveLength(1);
    expect(checkRunAt(github.state, 0)).toMatchObject({
      name: 'outbox',
      head_sha: 'head1',
      status: 'completed',
      conclusion: 'failure',
      output: { title: 'omni-loop could not evaluate: boom' },
    });
  });

  it('falls back to the default check name when GitHub cannot be read, failing the check already started', async () => {
    const github = featureGitHub();
    await startCheck(github.octokit, { owner: 'acme', repo: 'widgets', headSha: 'head1', name: 'outbox' });
    const flaky = { request: (route: string, params?: Params) => {
      if (route === 'GET /repos/{owner}/{repo}/pulls/{pull_number}') return Promise.reject(new Error('502'));
      return github.octokit.request(route, params);
    } };
    await failed(flaky, '502');
    expect(checkRunAt(github.state, 0)).toMatchObject({ name: 'outbox', conclusion: 'failure' });
  });

  it('a snapshot over its bound throws, naming the bound', async () => {
    const github = featureGitHub();
    const huge = { request: async (route: string, params: Params = {}) => {
      const response = await github.octokit.request(route, params);
      if (route.endsWith('/git/trees/{tree_sha}') && params.recursive === '1' && String(params.tree_sha).startsWith('head1')) {
        const many = Array.from({ length: 2001 }, (_, i) => ({ path: `f${i}.md`, mode: '100644', type: 'blob', sha: `x${i}`, size: 1 }));
        return { data: { ...TreeAnswerSchema.parse(response).data, tree: many } };
      }
      return response;
    } };
    const { error } = await run(huge);
    expect(error).toHaveProperty('message', expect.stringMatching(/over the bound of 2,000 files/));
  });
});

describe('outbox-check — only an Omni Loop feature PR is gated (issue 876)', () => {
  const RATE_LIMIT = 'API rate limit exceeded for installation ID 7.';
  const dependabotPr = { number: 12, base: { ref: 'main', sha: 'base1' }, head: { ref: 'dependabot/npm_and_yarn/brace-expansion-5.0.12', sha: 'head1' } };
  const plainFeaturePr = { number: 12, base: { ref: 'main', sha: 'base1' }, head: { ref: 'feat/VS-29444-gantt-node-move-dates', sha: 'head1' } };

  /** A GitHub that rate-limits every read past the pull request and the base config, as on nimbus-backend-php#6333. */
  function rateLimitedAfterClassify(github: ReturnType<typeof featureGitHub>) {
    return { request: (route: string, params?: Params) => {
      if (route === 'GET /repos/{owner}/{repo}/compare/{basehead}') return Promise.reject(new Error(RATE_LIMIT));
      if (route === 'GET /repos/{owner}/{repo}/issues/{issue_number}/comments') return Promise.reject(new Error(RATE_LIMIT));
      return github.octokit.request(route, params);
    } };
  }

  /** The conclusion of the last check run the job posted. */
  const lastConclusion = (github: ReturnType<typeof featureGitHub>) => checkRunAt(github.state, -1).conclusion;

  for (const [kind, pull] of [['a dependabot PR', dependabotPr], ['a plain feature PR', plainFeaturePr]] as const) {
    it(`${kind}: one check, completed skipped, before any gate read`, async () => {
      const github = featureGitHub({ pull });
      await run(github.octokit);
      expect(github.state.checkRuns).toEqual([
        expect.objectContaining({ name: 'outbox', head_sha: 'head1', status: 'completed', conclusion: 'skipped' }),
      ]);
      const reads = github.state.requests.map((r) => r.route);
      expect(reads).not.toContain('GET /repos/{owner}/{repo}/compare/{basehead}');
      expect(reads).not.toContain('GET /repos/{owner}/{repo}/issues/{issue_number}/comments');
    });

    it(`${kind}: a job GitHub rate-limits never ends red`, async () => {
      const github = featureGitHub({ pull });
      await run(rateLimitedAfterClassify(github));
      await failed(github.octokit, RATE_LIMIT);
      expect(github.state.checkRuns.map((r) => r.conclusion)).not.toContain('failure');
      expect(github.state.checkRuns.map((r) => r.status)).not.toContain('in_progress');
    });

    it(`${kind}: the failure hook, run with no check yet, posts skipped — never failure`, async () => {
      const github = featureGitHub({ pull });
      await failed(github.octokit, RATE_LIMIT);
      expect(github.state.checkRuns).toEqual([
        expect.objectContaining({ status: 'completed', conclusion: 'skipped' }),
      ]);
    });

    it(`${kind}: a re-synchronize keeps it skipped`, async () => {
      const github = featureGitHub({ pull });
      await run(github.octokit);
      github.state.pull.head.sha = 'head1';
      await run(github.octokit);
      expect(github.state.checkRuns.map((r) => r.conclusion)).toEqual(['skipped', 'skipped']);
    });
  }

  describe('a target feature PR (issue 1202)', () => {
    const targetPr = { number: 12, base: { ref: 'main', sha: 'base1' }, head: { ref: 'feat/crew-api', sha: 'head1' }, body: 'Part of acme/plan#8' };
    const planPulls = { 'acme/plan': [{ number: 37, body: 'Closes #8' }] };

    it('passes before any gate read, pointing to the plan PR', async () => {
      const github = featureGitHub({ pull: targetPr, others: planPulls });
      await run(github.octokit);
      expect(github.state.checkRuns).toEqual([expect.objectContaining({ name: 'outbox', status: 'completed', conclusion: 'success' })]);
      const reads = github.state.requests.map((r) => r.route);
      expect(reads).not.toContain('GET /repos/{owner}/{repo}/compare/{basehead}');
      expect(reads).not.toContain('GET /repos/{owner}/{repo}/issues/{issue_number}/comments');
    });

    it('the failure hook, run with no check yet, passes it too — never failure, never skipped', async () => {
      const github = featureGitHub({ pull: targetPr, others: planPulls });
      await failed(github.octokit, RATE_LIMIT);
      expect(github.state.checkRuns).toEqual([expect.objectContaining({ status: 'completed', conclusion: 'success' })]);
    });

    it('a sub-PR in the target, into its feature branch, stays skipped whatever its body says', async () => {
      const github = featureGitHub({ pull: { ...targetPr, base: { ref: 'feat/crew-api', sha: 'base1' }, head: { ref: 'feat/crew-api--s1', sha: 'head1' } }, others: planPulls });
      await run(github.octokit);
      expect(lastConclusion(github)).toBe('skipped');
    });

    it('a body naming this same repository stays skipped, as today', async () => {
      const github = featureGitHub({ pull: { ...targetPr, body: 'Part of acme/widgets#8' } });
      await run(github.octokit);
      expect(lastConclusion(github)).toBe('skipped');
    });

    it('a body saying Closes #<n> too is gated here: Closes wins', async () => {
      const github = featureGitHub({ pull: { ...targetPr, head: { ref: 'feat/widget', sha: 'head1' }, body: 'Closes #42\nPart of acme/plan#8' }, others: planPulls });
      await run(github.octokit);
      expect(lastConclusion(github)).toBe('failure');
    });

    it('a target\'s fix PR defers to the plan PR too, where its record lives (PRD 1342)', async () => {
      const fixPr = { ...targetPr, head: { ref: 'fix/77-crash', sha: 'head1' } };
      const github = featureGitHub({ commits: { base1: fixture('base-laws'), head1: fixture('head-laws-fix') }, pull: fixPr, others: planPulls });
      await run(github.octokit);
      expect(lastConclusion(github)).toBe('success');
      expect(github.state.requests.map((r) => r.route)).not.toContain('GET /repos/{owner}/{repo}/compare/{basehead}');
    });

    it('a GitHub error other than 403 or 404 on the plan repository is not swallowed', async () => {
      const github = featureGitHub({ pull: targetPr });
      const broken = { request: (route: string, params?: Params) =>
        route === 'GET /repos/{owner}/{repo}/pulls' ? Promise.reject(Object.assign(new Error('boom'), { status: 500 })) : github.octokit.request(route, params) };
      const { error } = await run(broken);
      expect(error).toBeDefined();
    });
  });

  it('the failure hook posts nothing when it cannot tell what the pull request is', async () => {
    const github = featureGitHub({ pull: dependabotPr });
    const down = { request: (route: string, params?: Params) => {
      if (route.startsWith('GET ')) return Promise.reject(new Error(RATE_LIMIT));
      return github.octokit.request(route, params);
    } };
    await failed(down, RATE_LIMIT);
    expect(github.state.checkRuns).toEqual([]);
  });

  it('an Omni Loop feature PR GitHub rate-limits still fails closed', async () => {
    const github = featureGitHub();
    await run(rateLimitedAfterClassify(github));
    await failed(github.octokit, RATE_LIMIT);
    expect(github.state.checkRuns).toEqual([
      expect.objectContaining({ status: 'completed', conclusion: 'failure' }),
    ]);
  });

  it('an Omni Loop feature PR with an open outbox item is still red', async () => {
    const github = featureGitHub();
    await run(github.octokit);
    expect(lastConclusion(github)).toBe('failure');
  });
});

describe('outbox-check — the live gate grades the pull request', () => {
  /** The check run the live job completes for a feature PR at `head`, the range changing `files`. */
  async function liveCheck(head: string, files: { filename: string; status: string }[] = []) {
    const github = featureGitHub({ commits: { base1: fixture('base-active'), head1: fixture(head) }, files });
    await run(github.octokit);
    return checkRunAt(github.state, -1);
  }

  // Law BR-PRODUCT-6 (.omni-loop/knowledge/product/rules.md, #1468).
  it('law BR-PRODUCT-6: the live check passes the changed files to the gate, so an unexplained risky change turns it red, as do open questions and unfinished rework', async () => {
    expect(await liveCheck('head-clear')).toMatchObject({ conclusion: 'success' });
    expect(await liveCheck('head-clear', [{ filename: 'src/widget.test.ts', status: 'removed' }]))
      .toMatchObject({ conclusion: 'failure', output: { title: '1 unaccounted risky change' } });
    expect(await liveCheck('head-open')).toMatchObject({ conclusion: 'failure', output: { title: '1 open outbox item' } });
    expect(await liveCheck('head-drift')).toMatchObject({ conclusion: 'failure', output: { title: 'unreworked drift' } });
  });
});
