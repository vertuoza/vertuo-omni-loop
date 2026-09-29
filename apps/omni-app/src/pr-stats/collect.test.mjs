import { describe, expect, it } from 'vitest';
import { BACKFILL_DAYS, BATCH, collectAll } from './collect.mjs';
import { fakeGitHub, fakeStore, pull } from './fake.mjs';
import { SIGNATURE } from './signed.mjs';

const NOW = Date.parse('2026-09-29T12:00:00Z');
const WS = 'ws-vertuoza';
const step = { run: async (_id, fn) => JSON.parse(JSON.stringify((await fn()) ?? null)) };
const daysAgo = (days) => new Date(NOW - days * 24 * 60 * 60 * 1000).toISOString();

function run({ store, github, now = NOW }) {
  return collectAll({ store, octokitFor: async () => github.octokit, step, now });
}

const pullsListed = (github, repo) => github.requests.filter((request) => request.route === 'GET /repos/{owner}/{repo}/pulls' && request.repo === repo);
const detailsRead = (github) => github.requests.filter((request) => request.route === 'GET /repos/{owner}/{repo}/pulls/{pull_number}').map((request) => request.pull_number);

describe('prStats — collecting a tracked repository', () => {
  it('backfills 90 days on the first run and sets the cursor', async () => {
    expect(BACKFILL_DAYS).toBe(90);
    const github = fakeGitHub({
      'vertuoza/apps': {
        pulls: [
          pull(1, { created_at: daysAgo(120), updated_at: daysAgo(100) }),
          pull(2, { created_at: daysAgo(80), updated_at: daysAgo(60) }),
          pull(3, { created_at: daysAgo(5), updated_at: daysAgo(1), merged_at: daysAgo(1), closed_at: daysAgo(1), merged_by: { login: 'bob', type: 'User' } }),
        ],
      },
    });
    const store = fakeStore([{ workspaceId: WS, installationId: 7, fullName: 'vertuoza/apps' }]);

    await run({ store, github });

    expect([...store.state.pulls.keys()].sort()).toEqual([`${WS}|vertuoza/apps|2`, `${WS}|vertuoza/apps|3`]);
    const repository = store.state.repositories[0];
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
      commits: 1,
      additions: 10,
      deletions: 2,
      omni_signed: false,
    });
  });

  it('reads only what was updated after the cursor on the next run', async () => {
    const repos = { 'vertuoza/apps': { pulls: [pull(1, { updated_at: daysAgo(3) }), pull(2, { updated_at: daysAgo(2) })] } };
    const store = fakeStore([{ workspaceId: WS, installationId: 7, fullName: 'vertuoza/apps' }]);
    await run({ store, github: fakeGitHub(repos) });

    repos['vertuoza/apps'].pulls.push(pull(3, { updated_at: daysAgo(0.5) }));
    const second = fakeGitHub(repos);
    await run({ store, github: second });

    expect(detailsRead(second)).toEqual([3]);
    expect(store.state.repositories[0].collectedUntil).toBe(daysAgo(0.5));
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
    expect(store.state.repositories[1].collectedAt).toBeNull();
  });

  it('records a 404 or a rate limit on that repository only, and collects the others', async () => {
    const github = fakeGitHub({
      'vertuoza/gone': { fail: { status: 404, message: 'Not Found' } },
      'vertuoza/busy': { pulls: [pull(1, { updated_at: daysAgo(3) }), pull(2, { updated_at: daysAgo(2) })], fail: { status: 403, message: 'API rate limit exceeded', after: 1 } },
      'vertuoza/apps': { pulls: [pull(1, { updated_at: daysAgo(1) })] },
    });
    const store = fakeStore([
      { workspaceId: WS, installationId: 7, fullName: 'vertuoza/gone' },
      { workspaceId: WS, installationId: 7, fullName: 'vertuoza/busy' },
      { workspaceId: WS, installationId: 7, fullName: 'vertuoza/apps' },
    ]);

    const result = await run({ store, github });

    const [gone, busy, apps] = store.state.repositories;
    expect(gone.collectError).toMatch(/404/);
    expect(gone.collectedAt).toBeNull();
    expect(busy.collectError).toMatch(/rate limit/);
    expect(busy.collectedUntil).toBe(daysAgo(3)); // the pull saved before the limit: resumed from there
    expect(apps.collectError).toBeNull();
    expect(apps.collectedAt).toBe(new Date(NOW).toISOString());
    expect(store.state.pulls.has(`${WS}|vertuoza/apps|1`)).toBe(true);
    expect(result.failed).toBe(2);
  });

  it('clears an earlier failure once a collection succeeds', async () => {
    const store = fakeStore([{ workspaceId: WS, installationId: 7, fullName: 'vertuoza/apps', collectError: 'HTTP 404: Not Found' }]);
    await run({ store, github: fakeGitHub({ 'vertuoza/apps': { pulls: [] } }) });
    expect(store.state.repositories[0].collectError).toBeNull();
    expect(store.state.repositories[0].collectedAt).toBe(new Date(NOW).toISOString());
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

    const signed = (n) => store.state.pulls.get(`${WS}|vertuoza/apps|${n}`).omni_signed;
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
    const at = (index) => (index < BATCH - 1 ? daysAgo(20 - index * 0.01) : index < BATCH + 5 ? same : daysAgo(5 - index * 0.01));
    const pulls = Array.from({ length: BATCH + 15 }, (_, index) => pull(index + 1, { updated_at: at(index) }));
    const github = fakeGitHub({ 'vertuoza/apps': { pulls } });
    const store = fakeStore([{ workspaceId: WS, installationId: 7, fullName: 'vertuoza/apps' }]);
    const ids = [];
    await collectAll({ store, octokitFor: async () => github.octokit, step: { run: (id, fn) => (ids.push(id), step.run(id, fn)) }, now: NOW });

    expect(store.state.pulls.size).toBe(BATCH + 15);
    expect(ids.filter((id) => id.startsWith('collect ')).length).toBe(2);
    expect(store.state.repositories[0].collectedUntil).toBe(at(BATCH + 14));
  });
});
