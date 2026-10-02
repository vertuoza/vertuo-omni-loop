import { describe, expect, it } from 'vitest';
import { BACKFILL_DAYS, BATCH, type CollectStep, collectAll } from './collect.ts';
import { fakeGitHub, fakeStore, pull } from './fake.ts';

type FakeGitHub = ReturnType<typeof fakeGitHub>;
type FakeStore = ReturnType<typeof fakeStore>;
type Repo = FakeStore['state']['repositories'][number];
import { SIGNATURE } from './signed.ts';

const NOW = Date.parse('2026-09-29T12:00:00Z');
const WS = 'ws-vertuoza';
const step: CollectStep = { run: async (_id, fn) => JSON.parse(JSON.stringify((await fn()) ?? null)) };
const daysAgo = (days: number) => new Date(NOW - days * 24 * 60 * 60 * 1000).toISOString();

function run({ store, github, now = NOW }: { store: FakeStore; github: FakeGitHub; now?: number }) {
  return collectAll({ store, octokitFor: async () => github.octokit, step, now });
}

const pullsListed = (github: FakeGitHub, repo: string) => github.queries.filter((query) => query.operation === 'PullsUpdated' && query.repo === repo);
const statusRead = (github: FakeGitHub) => github.queries.filter((query) => query.operation === 'PullStatus').flatMap((query) => query.numbers);
const detailsRead = (github: FakeGitHub) => github.queries.filter((query) => query.operation === 'PullDetails').flatMap((query) => query.numbers);

describe('prStats — collecting a tracked repository', () => {
  it('backfills 90 days on the first run and sets the cursor', async () => {
    expect(BACKFILL_DAYS).toBe(90);
    const github = fakeGitHub({
      'vertuoza/apps': {
        pulls: [
          pull(1, { created_at: daysAgo(120), updated_at: daysAgo(100) }),
          pull(2, { created_at: daysAgo(80), updated_at: daysAgo(60) }),
          pull(3, { created_at: daysAgo(5), updated_at: daysAgo(1), merged_at: daysAgo(1), closed_at: daysAgo(1), merged_by: { login: 'bob', type: 'User' }, head: { ref: 'feat/three' } }),
        ],
      },
    });
    const store = fakeStore([{ workspaceId: WS, installationId: 7, fullName: 'vertuoza/apps' }]);

    await run({ store, github });

    expect([...store.state.pulls.keys()].sort()).toEqual([`${WS}|vertuoza/apps|2`, `${WS}|vertuoza/apps|3`]);
    const repository = store.state.repositories[0]!;
    expect(repository.collectedUntil).toBe(daysAgo(1));
    expect(repository.collectedAt).toBe(new Date(NOW).toISOString());
    expect(repository.collectError).toBeNull();
    expect(store.state.pulls.get(`${WS}|vertuoza/apps|3`)).toEqual({
      workspace_id: WS,
      repo: 'vertuoza/apps',
      number: 3,
      author: 'ana',
      author_is_bot: false,
      opened_at: daysAgo(5),
      merged_at: daysAgo(1),
      closed_at: daysAgo(1),
      merged_by: 'bob',
      base: 'main',
      head: 'feat/three',
      draft: false,
      labels: [],
      head_committed_at: daysAgo(5),
      status_state: null,
      needs_fix_at: null,
      commits: 1,
      additions: 10,
      deletions: 2,
      omni_signed: false,
    });
  });

  it('writes each pull request\'s draft state, its label names and its latest commit\'s committed date (PRD 714)', async () => {
    const github = fakeGitHub({
      'vertuoza/apps': {
        pulls: [
          pull(1, {
            updated_at: daysAgo(1), draft: true, labels: [{ name: 'omni:needs-fix' }, { name: 'omni:sub' }],
            commits: 2, commitMessages: ['chore(s1): claim', 'feat: the slice'], commit_dates: [daysAgo(3), daysAgo(2)],
          }),
          pull(2, { updated_at: daysAgo(1), commits: 0, commitMessages: [] }),
        ],
      },
    });
    const store = fakeStore([{ workspaceId: WS, installationId: 7, fullName: 'vertuoza/apps' }]);

    await run({ store, github });

    const first = store.state.pulls.get(`${WS}|vertuoza/apps|1`);
    expect(first).toMatchObject({ draft: true, labels: ['omni:needs-fix', 'omni:sub'], head_committed_at: daysAgo(2) });
    const second = store.state.pulls.get(`${WS}|vertuoza/apps|2`);
    expect(second).toMatchObject({ draft: false, labels: [], head_committed_at: null });
  });

  it('writes when omni:needs-fix was first added, from the label events, and null without one (PRD 714 s4)', async () => {
    const github = fakeGitHub({
      'vertuoza/apps': {
        pulls: [
          pull(1, {
            updated_at: daysAgo(1),
            label_events: [
              { name: 'omni:sub', created_at: daysAgo(5) },
              { name: 'omni:needs-fix', created_at: daysAgo(4) },
              { name: 'omni:needs-fix', created_at: daysAgo(2) },
            ],
          }),
          pull(2, { updated_at: daysAgo(1), label_events: [{ name: 'omni:sub', created_at: daysAgo(3) }] }),
          pull(3, { updated_at: daysAgo(1) }),
        ],
      },
    });
    const store = fakeStore([{ workspaceId: WS, installationId: 7, fullName: 'vertuoza/apps' }]);

    await run({ store, github });

    const needsFixAt = (n: number) => store.state.pulls.get(`${WS}|vertuoza/apps|${n}`)!.needs_fix_at;
    expect([needsFixAt(1), needsFixAt(2), needsFixAt(3)]).toEqual([daysAgo(4), null, null]);
  });

  it('changes no count when it runs twice in a row over the new columns (PRD 714)', async () => {
    const trailer = `Co-authored-by: ${SIGNATURE.name} <${SIGNATURE.email}>`;
    const repos = {
      'vertuoza/apps': {
        pulls: [
          pull(1, {
            updated_at: daysAgo(3), base: { ref: 'feat/x' }, head: { ref: 'feat/x--s1' }, commitMessages: [`feat: a\n\n${trailer}`],
            merged_at: daysAgo(3), closed_at: daysAgo(3), merged_by: { login: 'ana', type: 'User' },
            labels: [{ name: 'omni:needs-fix' }], label_events: [{ name: 'omni:needs-fix', created_at: daysAgo(3.5) }],
          }),
          pull(2, { updated_at: daysAgo(2), draft: true, commitMessages: [`chore(s2): claim\n\n${trailer}`], comments: ['<!-- omni-outbox-status -->\n- state: stuck'] }),
        ],
      },
    };
    const store = fakeStore([{ workspaceId: WS, installationId: 7, fullName: 'vertuoza/apps' }]);
    await run({ store, github: fakeGitHub(repos) });
    const pulls = structuredClone([...store.state.pulls]);
    expect(pulls.map(([, row]) => row.needs_fix_at)).toEqual([daysAgo(3.5), null]);

    store.state.repositories[0]!.collectedUntil = null;
    await run({ store, github: fakeGitHub(repos) });

    expect([...store.state.pulls]).toEqual(pulls);
  });

  it('reads only what was updated after the cursor on the next run', async () => {
    const repos = { 'vertuoza/apps': { pulls: [pull(1, { updated_at: daysAgo(3) }), pull(2, { updated_at: daysAgo(2) })] } };
    const store = fakeStore([{ workspaceId: WS, installationId: 7, fullName: 'vertuoza/apps' }]);
    await run({ store, github: fakeGitHub(repos) });

    repos['vertuoza/apps'].pulls.push(pull(3, { updated_at: daysAgo(0.5) }));
    const second = fakeGitHub(repos);
    await run({ store, github: second });

    expect(detailsRead(second)).toEqual([3]);
    expect(store.state.repositories[0]!.collectedUntil).toBe(daysAgo(0.5));
  });

  it('writes identical rows when it runs twice in a row', async () => {
    const repos = {
      'vertuoza/apps': {
        pulls: [
          pull(1, { updated_at: daysAgo(3), reviews: [{ user: { login: 'bob' }, submitted_at: daysAgo(2.5), state: 'APPROVED' }] }),
          pull(2, { updated_at: daysAgo(2) }),
        ],
      },
    };
    const store = fakeStore([{ workspaceId: WS, installationId: 7, fullName: 'vertuoza/apps' }]);
    await run({ store, github: fakeGitHub(repos) });
    const pulls = structuredClone([...store.state.pulls]);
    const reviews = structuredClone([...store.state.reviews]);

    await run({ store, github: fakeGitHub(repos) });

    expect([...store.state.pulls]).toEqual(pulls);
    expect([...store.state.reviews]).toEqual(reviews);
  });

  it('never reads an untracked repository, nor one of a workspace without an installation', async () => {
    const github = fakeGitHub({ 'vertuoza/apps': { pulls: [pull(1, { updated_at: daysAgo(1) })] }, 'vertuoza/old': { pulls: [pull(1)] }, 'acme/x': { pulls: [pull(1)] } });
    const store = fakeStore([
      { workspaceId: WS, installationId: 7, fullName: 'vertuoza/apps' },
      { workspaceId: WS, installationId: 7, fullName: 'vertuoza/old', tracked: false },
      { workspaceId: 'ws-acme', installationId: null, fullName: 'acme/x' },
    ]);

    await run({ store, github });

    expect(pullsListed(github, 'old')).toEqual([]);
    expect(pullsListed(github, 'x')).toEqual([]);
    expect(store.state.repositories[1]!.collectedAt).toBeNull();
  });

  it('records a 404 or a rate limit on that repository only, and collects the others', async () => {
    const busyPulls = Array.from({ length: BATCH + 1 }, (_, index) => pull(index + 1, { updated_at: daysAgo(3 - index * 0.01) }));
    const github = fakeGitHub({
      'vertuoza/gone': { fail: { status: 404, message: 'Not Found' } },
      // One batch read, then a rate limit on the second.
      'vertuoza/busy': { pulls: busyPulls, fail: { status: 403, message: 'API rate limit exceeded', after: 1 } },
      'vertuoza/apps': { pulls: [pull(1, { updated_at: daysAgo(1) })] },
    });
    const store = fakeStore([
      { workspaceId: WS, installationId: 7, fullName: 'vertuoza/gone' },
      { workspaceId: WS, installationId: 7, fullName: 'vertuoza/busy' },
      { workspaceId: WS, installationId: 7, fullName: 'vertuoza/apps' },
    ]);

    const result = await run({ store, github });

    const [gone, busy, apps] = store.state.repositories as [Repo, Repo, Repo];
    expect(gone.collectError).toMatch(/404/);
    expect(gone.collectedAt).toBeNull();
    expect(busy.collectError).toMatch(/rate limit/);
    expect(busy.collectedUntil).toBe(daysAgo(3 - (BATCH - 1) * 0.01)); // the batch saved before the limit: resumed from there
    expect(store.state.pulls.has(`${WS}|vertuoza/busy|${BATCH}`)).toBe(true);
    expect(store.state.pulls.has(`${WS}|vertuoza/busy|${BATCH + 1}`)).toBe(false);
    expect(apps.collectError).toBeNull();
    expect(apps.collectedAt).toBe(new Date(NOW).toISOString());
    expect(store.state.pulls.has(`${WS}|vertuoza/apps|1`)).toBe(true);
    expect(result.failed).toBe(2);
  });

  it('records a repository GitHub cannot resolve as NOT_FOUND', async () => {
    const store = fakeStore([{ workspaceId: WS, installationId: 7, fullName: 'vertuoza/renamed' }]);
    const result = await run({ store, github: fakeGitHub({}) });
    expect(store.state.repositories[0]!.collectError).toBe("NOT_FOUND: Could not resolve to a Repository with the name 'vertuoza/renamed'.");
    expect(result.failed).toBe(1);
  });

  it('clears an earlier failure once a collection succeeds', async () => {
    const store = fakeStore([{ workspaceId: WS, installationId: 7, fullName: 'vertuoza/apps', collectError: 'HTTP 404: Not Found' }]);
    await run({ store, github: fakeGitHub({ 'vertuoza/apps': { pulls: [] } }) });
    expect(store.state.repositories[0]!.collectError).toBeNull();
    expect(store.state.repositories[0]!.collectedAt).toBe(new Date(NOW).toISOString());
  });

  describe('the status comment (PRD 714 s3)', () => {
    const trailer = `Co-authored-by: ${SIGNATURE.name} <${SIGNATURE.email}>`;
    const signed = { commitMessages: [`feat: a\n\n${trailer}`] };
    const status = (state: string) => `<!-- omni-outbox-status -->\n**Agent status** · updated 2026-09-29 10:00 UTC\n\n- state: ${state}\n- attempt: 3 / 3\n- human steps: none`;
    const merged = { merged_at: daysAgo(1), closed_at: daysAgo(1), merged_by: { login: 'bob', type: 'User' } };

    it('reads the state line of the marked comment, for open signed pull requests into main, master or develop only', async () => {
      const github = fakeGitHub({
        'vertuoza/apps': {
          pulls: [
            pull(1, { updated_at: daysAgo(9), ...signed, comments: ['Looks good', status('stuck'), 'later'] }),
            pull(2, { updated_at: daysAgo(8), ...signed, base: { ref: 'develop' }, comments: [status('waiting for CI (run 42)')] }),
            pull(3, { updated_at: daysAgo(7), ...signed, base: { ref: 'master' }, comments: ['no marker here', '<!-- vertuo-outbox-status -->\n- state: stuck'] }),
            pull(4, { updated_at: daysAgo(6), ...signed, base: { ref: 'feat/x' }, head: { ref: 'feat/x--s1' }, comments: [status('stuck')] }),
            pull(5, { updated_at: daysAgo(5), ...signed, ...merged, comments: [status('done')] }),
            pull(6, { updated_at: daysAgo(4), ...signed, closed_at: daysAgo(1), comments: [status('stuck')] }),
            pull(7, { updated_at: daysAgo(3), comments: [status('stuck')] }),
          ],
        },
      });
      const store = fakeStore([{ workspaceId: WS, installationId: 7, fullName: 'vertuoza/apps' }]);

      await run({ store, github });

      expect(statusRead(github)).toEqual([1, 2, 3]);
      const state = (n: number) => store.state.pulls.get(`${WS}|vertuoza/apps|${n}`)!.status_state;
      expect([1, 2, 3, 4, 5, 6, 7].map(state)).toEqual(['stuck', 'waiting for CI (run 42)', null, null, null, null, null]);
    });

    it('sends no status query for a batch with no open signed pull request into a main branch', async () => {
      const github = fakeGitHub({
        'vertuoza/apps': {
          pulls: [
            pull(1, { updated_at: daysAgo(3), comments: [status('stuck')] }),
            pull(2, { updated_at: daysAgo(2), ...signed, ...merged, comments: [status('done')] }),
            pull(3, { updated_at: daysAgo(1), ...signed, base: { ref: 'feat/x' }, comments: [status('claimed')] }),
          ],
        },
      });
      const store = fakeStore([{ workspaceId: WS, installationId: 7, fullName: 'vertuoza/apps' }]);

      await run({ store, github });

      expect(github.queries.map((query) => query.operation)).not.toContain('PullStatus');
      expect(store.state.pulls.size).toBe(3);
    });
  });

  it('marks omni_signed by trailer, footer marker and bot author, and false otherwise', async () => {
    const trailer = `Co-authored-by: ${SIGNATURE.name} <${SIGNATURE.email}>`;
    const github = fakeGitHub({
      'vertuoza/apps': {
        pulls: [
          pull(1, { updated_at: daysAgo(4), commitMessages: ['feat: a', `feat: b\n\n${trailer}`] }),
          pull(2, { updated_at: daysAgo(3), body: 'x\n\n🦸 Omni-man <!-- omni-loop:signed -->' }),
          pull(3, { updated_at: daysAgo(2), user: { login: 'omni-loop-invader[bot]', type: 'Bot' } }),
          pull(4, { updated_at: daysAgo(1) }),
        ],
      },
    });
    const store = fakeStore([{ workspaceId: WS, installationId: 7, fullName: 'vertuoza/apps' }]);
    await run({ store, github });

    const signed = (n: number) => store.state.pulls.get(`${WS}|vertuoza/apps|${n}`)!.omni_signed;
    expect([signed(1), signed(2), signed(3), signed(4)]).toEqual([true, true, true, false]);
    expect(store.state.pulls.get(`${WS}|vertuoza/apps|3`)).toMatchObject({ author: 'omni-loop-invader[bot]', author_is_bot: true });
  });

  it('drops a self-review and keeps one row per reviewer, dated at the first', async () => {
    const github = fakeGitHub({
      'vertuoza/apps': {
        pulls: [
          pull(1, {
            updated_at: daysAgo(1),
            reviews: [
              { user: { login: 'ana' }, submitted_at: daysAgo(2), state: 'COMMENTED' },
              { user: { login: 'bob' }, submitted_at: daysAgo(1.5), state: 'CHANGES_REQUESTED' },
              { user: { login: 'bob' }, submitted_at: daysAgo(1.8), state: 'COMMENTED' },
              { user: { login: 'bob' }, submitted_at: daysAgo(1.2), state: 'APPROVED' },
              { user: { login: 'cid' }, submitted_at: null, state: 'PENDING' },
            ],
          }),
        ],
      },
    });
    const store = fakeStore([{ workspaceId: WS, installationId: 7, fullName: 'vertuoza/apps' }]);
    await run({ store, github });

    expect([...store.state.reviews.values()]).toEqual([
      { workspace_id: WS, repo: 'vertuoza/apps', number: 1, reviewer: 'bob', first_at: daysAgo(1.8) },
    ]);
  });

  it('collects a long backfill in batches, one step each, without losing pulls updated at the same instant', async () => {
    const same = daysAgo(10);
    // BATCH - 1 older pulls, then six updated at one instant across the batch's edge, then ten newer.
    const at = (index: number) => (index < BATCH - 1 ? daysAgo(20 - index * 0.01) : index < BATCH + 5 ? same : daysAgo(5 - index * 0.01));
    const pulls = Array.from({ length: BATCH + 15 }, (_, index) => pull(index + 1, { updated_at: at(index) }));
    const github = fakeGitHub({ 'vertuoza/apps': { pulls } });
    const store = fakeStore([{ workspaceId: WS, installationId: 7, fullName: 'vertuoza/apps' }]);
    const ids: string[] = [];
    await collectAll({ store, octokitFor: async () => github.octokit, step: { run: (id, fn) => (ids.push(id), step.run(id, fn)) }, now: NOW });

    expect(store.state.pulls.size).toBe(BATCH + 15);
    expect(ids.filter((id) => id.startsWith('collect ')).length).toBe(2);
    expect(store.state.repositories[0]!.collectedUntil).toBe(at(BATCH + 14));
  });
});
