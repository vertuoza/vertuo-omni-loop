import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseConfig } from 'vertuo-omni-plan/kit/lib/config.ts';
import { failing, httpError } from '../../../test/github-replay.ts';
import { FEATURE, MERGE_SHA, MERGED_AT } from '../../../test/retro-scenario.ts';
import { listPullsInto } from '../github.ts';
import { qualify } from '../qualify.ts';
import { delivery } from './delivery.ts';
import type { Finding, RetroPull } from './index.ts';
import { handles, replay } from './test-handles.ts';
import {
  COMMENTS,
  DELIVERY_PULLS,
  EVENTS,
  OWNER,
  REPO,
  STUCK_BODY,
  deliveryRecording,
  threadsAnswer,
} from './delivery.fixtures/github.ts';

const { gather, detect, section } = handles(delivery);

const fixture = (name: string) => readFileSync(new URL(`./delivery.fixtures/${name}`, import.meta.url), 'utf8');
const PLAN = fixture('plan.md');
const SETTLED = fixture('settled.md');

const config = parseConfig('kit: 1\n');
const FOLDER = '.omni-loop/delivery/shipped/0007-widget';
const pull = (n: number) => `https://github.com/${OWNER}/${REPO}/pull/${n}`;

const basePrd = { number: 7, topic: 'widget', title: 'Widgets', state: 'shipped', folder: FOLDER, plan: PLAN, settled: SETTLED, problem: '' };
const basePr = {
  number: 12,
  title: FEATURE.title,
  url: FEATURE.html_url,
  headRef: 'feat/widget',
  openedAt: FEATURE.created_at,
  mergedAt: MERGED_AT,
  mergeSha: MERGE_SHA,
  labels: ['omni:feature'],
};

/**
 * The stubbed GitHub for PRD 7: the recorded files and reviews, the label events and comments, and
 * GraphQL's review threads answered per pull request (a 404 for one it does not know).
 */
type Request = (route: string, params?: Params) => Promise<{ data: unknown }>;
type Params = { pull_number?: number; issue_number?: number; variables?: { number: number; after?: string | null } };
type Recorded = Params & { route: string };
type Stub = { octokit: { request: Request }; state: { requests: Recorded[] } };
type StubOptions = { threads?: (number: number, after: string | null) => unknown; events?: Record<number, object[]>; comments?: object[]; pulls?: object[] };

function stubGitHub({ threads = threadsAnswer, events = EVENTS, comments = COMMENTS, pulls = DELIVERY_PULLS }: StubOptions = {}) {
  const stub = replay({ recording: deliveryRecording(), pulls: [FEATURE, ...pulls], events });
  (stub.state.comments as object[]).push(...structuredClone(comments));
  const octokit = {
    async request(route: string, params: Params = {}) {
      if (route !== 'POST /graphql') return stub.octokit.request(route, params);
      (stub.state.requests as Recorded[]).push({ route, ...params });
      const answer = threads(params.variables!.number, params.variables!.after ?? null);
      if (!answer) throw httpError(404, `no threads for #${params.variables!.number}`);
      return { data: answer };
    },
  };
  return { ...stub, octokit } as Stub & Omit<typeof stub, 'octokit' | 'state'>;
}

async function run({ github = stubGitHub(), pr = basePr, prd = basePrd }: { github?: Stub; pr?: object; prd?: object } = {}) {
  const pulls: RetroPull[] = await listPullsInto(github.octokit, { owner: OWNER, repo: REPO, base: 'feat/widget' });
  const scope = { owner: OWNER, repo: REPO, mergeSha: MERGE_SHA, mergedAt: MERGED_AT, pr, prd, config, pulls };
  const records = await gather(github.octokit, scope);
  const { facts, findings } = detect(records, { pr, prd, config, pulls });
  return { github, records, facts, findings, pulls };
}

const requested = (github: Stub, route: string) =>
  github.state.requests
    .filter((request) => request.route === route)
    .map((request) => (request.pull_number ?? request.issue_number ?? request.variables?.number) as number)
    .sort((a, b) => a - b);

const byId = (findings: Finding[], id: string) => findings.find((finding) => finding.id === id)!;

describe('delivery — gather', () => {
  it('reads each merged sub-PR’s files, the reviews and threads of the feature PR and each merged sub-PR, and every sub-PR’s comments and label events', async () => {
    const { github } = await run();
    expect(requested(github, 'GET /repos/{owner}/{repo}/pulls/{pull_number}/files')).toEqual([13, 14, 15]);
    expect(requested(github, 'GET /repos/{owner}/{repo}/pulls/{pull_number}/reviews')).toEqual([12, 13, 14, 15]);
    expect(requested(github, 'POST /graphql')).toEqual([12, 13, 14, 15]);
    expect(requested(github, 'GET /repos/{owner}/{repo}/issues/{issue_number}/comments')).toEqual([13, 14, 15, 16]);
    expect(requested(github, 'GET /repos/{owner}/{repo}/issues/{issue_number}/events')).toEqual([13, 14, 15, 16]);
  });

  it('keeps plain records: changed paths, stuck comments, the times needs-fix was added, reviews and threads', async () => {
    const { records } = await run();
    expect(records.pulls[15]!.files).toEqual(['src/show/colour.mjs', 'src/registry.mjs', 'src/store/colour.mjs', 'README.md']);
    expect(records.pulls[16]!.files).toBeUndefined();
    expect(records.pulls[14]!.stuck).toEqual([{ url: `${pull(14)}#issuecomment-9002`, at: '2026-09-20T09:59:00Z', attempts: 3, text: STUCK_BODY }]);
    expect(records.pulls[14]!.needsFix).toEqual(['2026-09-20T09:58:00Z']);
    expect(records.pulls[13]!.needsFix).toEqual([]);
    expect(records.pulls[14]!.reviews).toEqual([
      {
        url: `${pull(14)}#pullrequestreview-1401`,
        author: 'claude[bot]',
        bot: true,
        state: 'COMMENTED',
        red: true,
        text: '🔴 **Bug:** the cache is never cleared, so a colour read once is read forever.',
      },
    ]);
    expect(records.pulls[12]!.reviews).toEqual([
      { url: `${pull(12)}#pullrequestreview-1201`, author: 'ada', bot: false, state: 'APPROVED', red: false, text: null },
    ]);
    expect(records.pulls[13]!.threads).toEqual([
      {
        url: `${pull(13)}#discussion_r1`,
        author: 'claude',
        bot: true,
        path: 'src/store/colour.mjs',
        resolved: true,
        outdated: false,
        red: true,
        text: '🔴 Off by one: the last colour is dropped.',
      },
    ]);
  });

  it('counts a renamed file under both its names', async () => {
    const github = stubGitHub();
    const renamed = [{ filename: 'src/read/colour.mjs', previous_filename: 'src/store/read.mjs', status: 'renamed' }];
    const octokit = {
      request: (route: string, params: Params = {}) =>
        route === 'GET /repos/{owner}/{repo}/pulls/{pull_number}/files' && params.pull_number === 14
          ? Promise.resolve({ data: renamed })
          : github.octokit.request(route, params),
    };
    const { records } = await run({ github: { ...github, octokit } });
    expect(records.pulls[14]!.files).toEqual(['src/read/colour.mjs', 'src/store/read.mjs']);
  });

  it('pages through review threads', async () => {
    const pages: Record<string, { nodes: object[]; next: string | null }> = {
      null: { nodes: [{ isResolved: true, isOutdated: false, path: 'a', comments: { nodes: [{ url: 'u1', body: 'x', author: { login: 'ada', __typename: 'User' } }] } }], next: 'c1' },
      c1: { nodes: [{ isResolved: false, isOutdated: true, path: 'b', comments: { nodes: [{ url: 'u2', body: 'y', author: null }] } }], next: null },
    };
    const threads = (number: number, after: string | null) => {
      if (number !== 15) return threadsAnswer(number);
      const page = pages[String(after)]!;
      return { data: { repository: { pullRequest: { reviewThreads: { pageInfo: { hasNextPage: page.next !== null, endCursor: page.next }, nodes: page.nodes } } } } };
    };
    const { records } = await run({ github: stubGitHub({ threads }) });
    expect(records.pulls[15]!.threads!.map((thread) => [thread.url, thread.author, thread.bot, thread.resolved, thread.outdated])).toEqual([
      ['u1', 'ada', false, true, false],
      ['u2', null, false, false, true],
    ]);
  });

  it('reads what the installation cannot see as unknown, never as nothing', async () => {
    const github = stubGitHub({ threads: () => null, events: {} });
    const octokit = {
      request(route: string, params: Params = {}) {
        if (route.endsWith('/files') && params.pull_number === 15) return Promise.reject(httpError(403, 'Resource not accessible by integration'));
        if (route.endsWith('/reviews') && params.pull_number === 14) return Promise.reject(httpError(404, 'Not Found'));
        if (route.endsWith('/comments') && params.issue_number === 16) return Promise.reject(httpError(403, 'Forbidden'));
        return github.octokit.request(route, params);
      },
    };
    const { records } = await run({ github: { ...github, octokit } });
    expect(records.pulls[15]!.files).toBeNull();
    expect(records.pulls[14]!.reviews).toBeNull();
    expect(records.pulls[16]!.stuck).toBeNull();
    expect(records.pulls[13]!.needsFix).toBeNull();
    expect(records.pulls[13]!.threads).toBeNull();
    expect(records.pulls[13]!.files).toHaveLength(3);
  });

  it('reads threads GraphQL refuses as unknown, and fails the step on any other GraphQL error', async () => {
    const refused = () => ({ data: null, errors: [{ type: 'FORBIDDEN', message: 'Resource not accessible by integration' }] });
    expect((await run({ github: stubGitHub({ threads: refused }) })).records.pulls[12]!.threads).toBeNull();
    const limited = () => ({ data: null, errors: [{ type: 'RATE_LIMITED', message: 'API rate limit exceeded' }] });
    await expect(run({ github: stubGitHub({ threads: limited }) })).rejects.toThrow('API rate limit exceeded');
  });

  it('lets any other GitHub failure fail the step, so Inngest retries it', async () => {
    const github = stubGitHub();
    const broken = failing(github.octokit, 'GET /repos/{owner}/{repo}/pulls/{pull_number}/files');
    await expect(run({ github: { ...github, octokit: broken } })).rejects.toThrow('GitHub is down');
  });
});

describe('delivery — territory', () => {
  it('finds the paths a merged sub-PR changed outside its slice’s territory', async () => {
    const { findings } = await run();
    expect(byId(findings, 'territory:s3')).toEqual({
      id: 'territory:s3',
      kind: 'territory',
      title: 'Slice s3 changed files outside its territory',
      happened:
        'Slice s3 changed 2 paths outside its territory and off the plan’s shared ground: `src/store/colour.mjs`, `README.md`.',
      evidence: [{ label: '#15', url: `${pull(15)}/files` }],
    });
    expect(findings.filter((finding) => finding.kind === 'territory').map((finding) => finding.id)).toEqual(['territory:s3']);
  });

  it('leaves shared ground and the PRD’s own outbox item and account files unflagged, and counts them', async () => {
    const { facts } = await run();
    expect(facts.territory.sharedGround).toEqual(['src/registry.mjs']);
    expect(facts.territory.counts).toEqual({ graded: 3, breaches: 2, shared: 1, unread: 0, unplanned: 0 });
    expect(facts.territory.pulls).toEqual([
      { slice: 's1', pr: 13, url: pull(13), status: 'graded', files: 3, breaches: [], shared: [] },
      { slice: 's2', pr: 14, url: pull(14), status: 'graded', files: 3, breaches: [], shared: [] },
      { slice: 's3', pr: 15, url: pull(15), status: 'graded', files: 4, breaches: ['src/store/colour.mjs', 'README.md'], shared: ['src/registry.mjs'] },
    ]);
  });

  it('names a sub-PR whose files could not be read, and one whose slice the plan does not hold, without grading them', async () => {
    const github = stubGitHub({
      pulls: [...DELIVERY_PULLS, { ...DELIVERY_PULLS[0]!, number: 19, html_url: pull(19), head: { ref: 'feat/widget--s9', sha: 'h19' } }],
    });
    const octokit = {
      request: (route: string, params: Params = {}) =>
        route.endsWith('/files') && params.pull_number === 19
          ? Promise.resolve({ data: [{ filename: 'src/nine.mjs', status: 'added' }] })
          : route.endsWith('/files') && params.pull_number === 15
            ? Promise.reject(httpError(404, 'Not Found'))
            : github.octokit.request(route, params),
    };
    const { facts, findings } = await run({ github: { ...github, octokit } });
    expect(facts.territory.counts).toEqual({ graded: 2, breaches: 0, shared: 0, unread: 1, unplanned: 1 });
    expect(facts.territory.pulls.filter((p) => p.status !== 'graded')).toEqual([
      { slice: 's9', pr: 19, url: pull(19), status: 'unplanned', files: 1, breaches: null, shared: null },
      { slice: 's3', pr: 15, url: pull(15), status: 'unread', files: null, breaches: null, shared: null },
    ]);
    expect(findings.filter((finding) => finding.kind === 'territory')).toEqual([]);
  });

  it('grades nothing, and says why, when the plan holds no slice table', async () => {
    const { facts, findings } = await run({ prd: { ...basePrd, plan: '# A plan with no table\n' } });
    expect(facts.territory).toMatchObject({ reason: 'no slice table was found in this plan', counts: { graded: 0 } });
    expect(findings.filter((finding) => finding.kind === 'territory')).toEqual([]);
    const none = await run({ prd: { ...basePrd, plan: null } });
    expect(none.facts.territory.reason).toBe('no plan at the merge');
  });
});

describe('delivery — friction', () => {
  it('finds a slice labelled needs-fix and stuck, with the stuck comment as evidence', async () => {
    const { findings } = await run();
    expect(byId(findings, 'friction:s2')).toEqual({
      id: 'friction:s2',
      kind: 'friction',
      title: 'Slice s2 went stuck',
      happened: 'Slice s2 was labelled `omni:needs-fix` and went stuck after 3 attempts.',
      evidence: [
        { label: 'stuck comment on #14', url: `${pull(14)}#issuecomment-9002` },
        { label: '#14', url: pull(14) },
      ],
    });
  });

  it('counts a second claim of one slice, without calling it a finding on its own', async () => {
    const { facts, findings } = await run();
    expect(facts.friction.counts).toEqual({ stuck: 1, needsFix: 1, reclaimed: 1, commentsUnread: 0, eventsUnread: 0 });
    expect(facts.friction.slices).toEqual([
      { slice: 's1', prs: [13], claims: 1, stuck: [], needsFix: [] },
      { slice: 's3', prs: [16, 15], claims: 2, stuck: [], needsFix: [] },
      {
        slice: 's2',
        prs: [14],
        claims: 1,
        stuck: [{ pr: 14, url: `${pull(14)}#issuecomment-9002`, at: '2026-09-20T09:59:00Z', attempts: 3, text: STUCK_BODY }],
        needsFix: [{ pr: 14, at: '2026-09-20T09:58:00Z' }],
      },
    ]);
    expect(byId(findings, 'friction:s3')).toBeUndefined();
  });

  it('says a slice claimed twice in the finding of a slice that also went stuck', async () => {
    const github = stubGitHub({ comments: [...COMMENTS, { ...COMMENTS[1]!, id: 9003, issue: 15, html_url: `${pull(15)}#issuecomment-9003` }] });
    const { findings } = await run({ github });
    expect(byId(findings, 'friction:s3').happened).toBe('Slice s3 went stuck after 3 attempts and was claimed 2 times.');
  });

  it('falls back on the labels a sub-PR carries now when its label events cannot be read', async () => {
    const labelled = DELIVERY_PULLS.map((p) => (p.number === 13 ? { ...p, labels: [...p.labels, { name: 'omni:needs-fix' }] } : p));
    const { facts, findings } = await run({ github: stubGitHub({ events: {}, pulls: labelled }) });
    expect(facts.friction.counts).toMatchObject({ needsFix: 1, eventsUnread: 4 });
    expect(facts.friction.slices[0]!.needsFix).toEqual([{ pr: 13, at: null }]);
    expect(byId(findings, 'friction:s1').happened).toBe('Slice s1 was labelled `omni:needs-fix`.');
    expect(byId(findings, 'friction:s2').happened).toBe('Slice s2 went stuck after 3 attempts.');
  });
});

describe('delivery — decisions', () => {
  it('counts the settled decisions by verdict and by rank, the latest entry of an id winning', async () => {
    const { facts } = await run();
    expect(facts.decisions).toEqual({
      file: `${FOLDER}/outbox/settled.md`,
      raised: 4,
      adopted: 1,
      agreed: 1,
      drifted: 2,
      reworked: 1,
      byRank: { high: 2, medium: 2 },
      drifts: [
        { id: 's2-02-read-order', rank: 'high', slice: 's2', reworkedBy: '#88' },
        { id: 's3-01-show-default', rank: 'medium', slice: 's3', reworkedBy: null },
      ],
    });
  });

  it('finds every drift, saying whether a rework closed it', async () => {
    const { findings } = await run();
    const settledUrl = `https://github.com/${OWNER}/${REPO}/blob/${MERGE_SHA}/${FOLDER}/outbox/settled.md`;
    expect(byId(findings, 'drift:s2-02-read-order')).toEqual({
      id: 'drift:s2-02-read-order',
      kind: 'drift',
      title: 'A decision of slice s2 drifted',
      happened:
        'The answer to decision `s2-02-read-order` (rank high, slice s2) disagreed with what was built; rework #88 brought the build back in line.',
      evidence: [
        { label: 'settled.md', url: settledUrl },
        { label: '#88', url: pull(88) },
      ],
    });
    expect(byId(findings, 'drift:s3-01-show-default')).toMatchObject({
      happened:
        'The answer to decision `s3-01-show-default` (rank medium, slice s3) disagreed with what was built; no rework had closed it at the merge.',
      evidence: [{ label: 'settled.md', url: settledUrl }],
    });
  });

  it('reads the settled file of a PRD merged without being shipped from the outbox folder', async () => {
    const prd = { ...basePrd, state: 'inbox', folder: '.omni-loop/delivery/inbox/0007-widget' };
    const { facts, findings } = await run({ prd });
    expect(facts.decisions.file).toBe('.omni-loop/delivery/outbox/0007-widget/settled.md');
    expect(byId(findings, 'drift:s2-02-read-order').evidence[0]!.url).toBe(
      `https://github.com/${OWNER}/${REPO}/blob/${MERGE_SHA}/.omni-loop/delivery/outbox/0007-widget/settled.md`,
    );
  });

  it('finds a merge under the override label', async () => {
    const { facts, findings } = await run({ pr: { ...basePr, labels: ['omni:feature', 'omni:outbox-go'] } });
    expect(facts.override).toEqual({ label: 'omni:outbox-go', mergedUnder: true });
    expect(byId(findings, 'override:#12')).toEqual({
      id: 'override:#12',
      kind: 'override',
      title: 'The feature PR merged under the override label',
      happened: 'Feature PR #12 merged carrying `omni:outbox-go`, the label that lets a merge through while the outbox gate is red.',
      evidence: [{ label: '#12', url: FEATURE.html_url }],
    });
    expect((await run()).facts.override).toEqual({ label: 'omni:outbox-go', mergedUnder: false });
  });

  it('counts nothing, and finds no drift, without a settled file', async () => {
    const { facts, findings } = await run({ prd: { ...basePrd, settled: null } });
    expect(facts.decisions).toEqual({ file: null, raised: 0, adopted: 0, agreed: 0, drifted: 0, reworked: 0, byRank: {}, drifts: [] });
    expect(findings.filter((finding) => finding.kind === 'drift')).toEqual([]);
  });
});

describe('delivery — review', () => {
  it('counts reviews and threads by author kind, red-circle bot findings and threads unresolved at the merge', async () => {
    const { facts } = await run();
    expect(facts.review.counts).toEqual({
      pulls: 4,
      reviews: 3,
      reviewsByPeople: 2,
      reviewsByBots: 1,
      threads: 2,
      threadsByPeople: 1,
      threadsByBots: 1,
      red: 2,
      unresolved: 1,
      reviewsUnread: 0,
      threadsUnread: 0,
    });
    expect(facts.review.pulls.map((p) => [p.pr, p.slice, p.red.length, p.unresolved.length])).toEqual([
      [12, null, 0, 0],
      [13, 's1', 1, 0],
      [14, 's2', 1, 0],
      [15, 's3', 0, 1],
    ]);
  });

  it('finds each pull request with a red-circle bot finding or a thread unresolved at the merge — never a person’s red circle', async () => {
    const { findings } = await run();
    expect(findings.filter((finding) => finding.kind === 'review')).toEqual([
      {
        id: 'review:#13',
        kind: 'review',
        title: 'Review findings on slice s1',
        happened: '#13, slice s1: 1 red-circle finding from a bot.',
        evidence: [{ label: 'red circle on src/store/colour.mjs', url: `${pull(13)}#discussion_r1` }],
      },
      {
        id: 'review:#14',
        kind: 'review',
        title: 'Review findings on slice s2',
        happened: '#14, slice s2: 1 red-circle finding from a bot.',
        evidence: [{ label: 'red circle in a review', url: `${pull(14)}#pullrequestreview-1401` }],
      },
      {
        id: 'review:#15',
        kind: 'review',
        title: 'Review findings on slice s3',
        happened: '#15, slice s3: 1 review thread unresolved at the merge.',
        evidence: [{ label: 'unresolved thread on src/show/colour.mjs', url: `${pull(15)}#discussion_r2` }],
      },
    ]);
  });

  it('names the feature PR when its review is where a finding was left', async () => {
    const threads = (number: number) =>
      number === 12
        ? { data: { repository: { pullRequest: { reviewThreads: { pageInfo: { hasNextPage: false, endCursor: null }, nodes: [
            { isResolved: false, isOutdated: false, path: 'README.md', comments: { nodes: [{ url: 'u12', body: '🔴 Wrong link.', author: { login: 'claude', __typename: 'Bot' } }] } },
          ] } } } } }
        : threadsAnswer(number);
    const { findings } = await run({ github: stubGitHub({ threads }) });
    expect(byId(findings, 'review:#12')).toMatchObject({
      title: 'Review findings on the feature PR',
      happened: '#12, the feature PR: 1 red-circle finding from a bot; 1 review thread unresolved at the merge.',
    });
  });

  it('counts only what it could read, and says what it could not', async () => {
    const { facts } = await run({ github: stubGitHub({ threads: () => null }) });
    expect(facts.review.counts).toMatchObject({ threads: 0, red: 1, unresolved: 0, threadsUnread: 4, reviewsUnread: 0 });
  });
});

describe('delivery — findings and section', () => {
  it('gives its findings in the rules’ order: override, drift, review, friction, territory', async () => {
    const { findings } = await run({ pr: { ...basePr, labels: ['omni:outbox-go'] } });
    expect(findings.map((finding) => finding.id)).toEqual([
      'override:#12',
      'drift:s2-02-read-order',
      'drift:s3-01-show-default',
      'review:#13',
      'review:#14',
      'review:#15',
      'friction:s2',
      'territory:s3',
    ]);
  });

  it('describes the decisions, the override, the territory, the friction and the review', async () => {
    const { facts } = await run();
    expect(section(facts)).toEqual([
      '- Decisions: 4 raised and settled — 1 adopted, 1 agreed, 2 drifted, 1 of them reworked; by rank: 2 high, 2 medium.',
      '- The feature PR merged without the override label `omni:outbox-go`.',
      '- Territory: 3 merged sub-PRs graded against the plan — 2 paths outside a slice’s territory, 1 more on shared ground.',
      '- Friction: 1 slice stuck, 1 labelled `omni:needs-fix`, 1 claimed more than once.',
      '- Review: 4 pull requests — 3 reviews (2 by people, 1 by bots), 2 review threads (1 by people, 1 by bots), 2 red-circle bot findings, 1 thread unresolved at the merge.',
    ]);
  });

  it('says what it could not read or grade', async () => {
    const { facts } = await run({ github: stubGitHub({ threads: () => null, events: {} }), prd: { ...basePrd, settled: null, plan: null } });
    expect(section(facts)).toEqual([
      '- Decisions: no settled file at the merge, so no decision is counted.',
      '- The feature PR merged without the override label `omni:outbox-go`.',
      '- Territory: not graded — no plan at the merge.',
      '- Friction: 1 slice stuck, 0 labelled `omni:needs-fix`, 1 claimed more than once; the label events of 4 sub-PRs could not be read, so only the labels they carry now count.',
      '- Review: 4 pull requests — 3 reviews (2 by people, 1 by bots), 1 red-circle bot finding; the review threads of 4 could not be read.',
    ]);
  });

  it('leaves its section out when it has no facts', () => {
    expect(section(null)).toBeNull();
  });

  it('holds its own place in the registry: the Decisions section, in the merge run', () => {
    expect([delivery.id, delivery.section, [...delivery.runs]]).toEqual(['delivery', 'Decisions', ['merge']]);
  });
});

describe('delivery — the PRD 50 recording', () => {
  const recording = JSON.parse(readFileSync(new URL('../../../test/fixtures/prd-50/recording.json', import.meta.url), 'utf8'));

  async function prd50() {
    const github = replay({ recording: recording.requests });
    const input = { owner: 'vertuoza', repo: 'vertuo-omni-loop', prNumber: 51, mergeSha: recording.mergeSha };
    const qualified = await qualify(github.octokit, input);
    if (qualified.skip !== null) throw new Error(qualified.skip);
    const { pr, prd, config: at } = qualified;
    const pulls = await listPullsInto(github.octokit, { owner: input.owner, repo: input.repo, base: pr.headRef });
    const scope = { owner: input.owner, repo: input.repo, mergeSha: input.mergeSha, mergedAt: pr.mergedAt, pr, prd, config: at, pulls };
    const records = await gather(github.octokit, scope);
    return detect(records, { pr, prd, config: at, pulls });
  }

  it('yields 4 adopted decisions and no drift', async () => {
    const { facts, findings } = await prd50();
    expect(facts.decisions).toMatchObject({ raised: 4, adopted: 4, agreed: 0, drifted: 0, reworked: 0, byRank: { medium: 4 }, drifts: [] });
    expect(findings.filter((finding) => finding.kind === 'drift')).toEqual([]);
  });

  it('grades its 3 sub-PRs inside their territories, their outbox items included, and finds nothing', async () => {
    const { facts, findings } = await prd50();
    expect(facts.territory.counts).toEqual({ graded: 3, breaches: 0, shared: 0, unread: 0, unplanned: 0 });
    expect(facts.territory.sharedGround).toEqual(['kit/dist/omni.mjs']);
    expect(facts.review.counts).toMatchObject({ pulls: 4, reviews: 0, threadsUnread: 4 });
    expect(findings).toEqual([]);
  });
});
