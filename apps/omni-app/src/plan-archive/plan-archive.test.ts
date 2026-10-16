// The plan archive against a stubbed GitHub and a stubbed database (PRD 2011 s17, acceptance 13): the
// function makes each plan repository's GitHub flag say what its product says, archives and unarchives
// through the one `PATCH /repos/{owner}/{repo}`, leaves a repository it may not change, and touches no
// branch or pull request. No test calls GitHub or Supabase.
import { InngestTestEngine } from '@inngest/test';
import { describe, expect, it } from 'vitest';
import { inngest } from '../inngest-client.ts';
import { createPlanArchive, EVERY_5_MINUTES, PLAN_ARCHIVE_FUNCTION_ID } from './plan-archive.ts';
import type { PlanRepository, PlanStore } from './store.ts';
import { planArchiveStore } from './store.ts';

type Call = { route: string; params: Record<string, unknown> };

/** GitHub holding `flags` (repository to archived), the App installed on `installed`, refusing a write with `refuse`. */
function github({ flags, installed = Object.keys(flags), refuse = null }: { flags: Record<string, boolean>; installed?: string[]; refuse?: number | null }) {
  const calls: Call[] = [];
  const fail = (status: number) => Promise.reject(Object.assign(new Error(`status ${String(status)}`), { status }));
  const octokit = {
    request(route: string, params: Record<string, unknown> = {}) {
      calls.push({ route, params });
      const name = `${String(params.owner)}/${String(params.repo)}`;
      if (route === 'GET /repos/{owner}/{repo}/installation') return installed.includes(name) ? Promise.resolve({ data: { id: 77 } }) : fail(404);
      if (route === 'GET /repos/{owner}/{repo}') return Promise.resolve({ data: { archived: flags[name] ?? false } });
      if (route === 'PATCH /repos/{owner}/{repo}') {
        if (refuse !== null) return fail(refuse);
        flags[name] = params.archived === true;
        return Promise.resolve({ data: {} });
      }
      return fail(500);
    },
  };
  return { octokit, calls, flags };
}

const storeOf = (plans: PlanRepository[]): PlanStore => ({ plans: () => Promise.resolve(plans) });

async function run(plans: PlanRepository[], gh: ReturnType<typeof github>) {
  const lines: string[] = [];
  const installs: number[] = [];
  const fn = createPlanArchive({
    client: inngest,
    octokitFor: (id) => { installs.push(id); return gh.octokit; },
    appOctokit: () => gh.octokit,
    store: storeOf(plans),
    log: (line) => lines.push(line),
  });
  const { result, error } = await new InngestTestEngine({ function: fn, events: [{ name: 'inngest/scheduled.timer', data: {} } as never] }).execute();
  return { result, error, lines, installs };
}

const writes = (gh: ReturnType<typeof github>) => gh.calls.filter((call) => call.route.startsWith('PATCH'));

describe('createPlanArchive — the plan repository, read-only through the App (PRD 2011 s17)', () => {
  it('runs every five minutes, under its own id', () => {
    const fn = createPlanArchive({ client: inngest, octokitFor: () => github({ flags: {} }).octokit, appOctokit: null, store: null });
    expect(fn.opts.id).toBe(PLAN_ARCHIVE_FUNCTION_ID);
    expect(fn.opts.triggers).toEqual([{ cron: EVERY_5_MINUTES }]);
  });

  it('archives a repository its product says is archived, as the installation, with one write', async () => {
    const gh = github({ flags: { 'acme/plan': false } });
    const { error, lines, installs } = await run([{ repository: 'acme/plan', archived: true }], gh);
    expect(error).toBeUndefined();
    expect(gh.flags['acme/plan']).toBe(true);
    expect(writes(gh)).toEqual([{ route: 'PATCH /repos/{owner}/{repo}', params: { owner: 'acme', repo: 'plan', archived: true } }]);
    expect(installs).toEqual([77]);
    expect(lines).toEqual(['plan archive: acme/plan archived on GitHub']);
  });

  it('unarchives it on Undo', async () => {
    const gh = github({ flags: { 'acme/plan': true } });
    const { lines } = await run([{ repository: 'acme/plan', archived: false }], gh);
    expect(gh.flags['acme/plan']).toBe(false);
    expect(lines).toEqual(['plan archive: acme/plan unarchived on GitHub']);
  });

  it('writes nothing when GitHub already says what the product says', async () => {
    const gh = github({ flags: { 'acme/plan': true, 'acme/other': false } });
    const { result, lines } = await run([{ repository: 'acme/other', archived: false }, { repository: 'acme/plan', archived: true }], gh);
    expect(writes(gh)).toEqual([]);
    expect(lines).toEqual([]);
    expect(result).toEqual({ plans: [{ repository: 'acme/other', did: 'in-step', why: null }, { repository: 'acme/plan', did: 'in-step', why: null }] });
  });

  it('leaves a repository the App is not installed on, and carries on with the next', async () => {
    const gh = github({ flags: { 'acme/plan': false, 'acme/two': false }, installed: ['acme/two'] });
    const { error, lines } = await run([{ repository: 'acme/plan', archived: true }, { repository: 'acme/two', archived: true }], gh);
    expect(error).toBeUndefined();
    expect(gh.flags).toEqual({ 'acme/plan': false, 'acme/two': true });
    expect(lines).toEqual(['plan archive: acme/plan left as it is: the App is not installed there', 'plan archive: acme/two archived on GitHub']);
  });

  it('leaves a repository GitHub refuses the write on (no administration permission), and says so', async () => {
    const gh = github({ flags: { 'acme/plan': false }, refuse: 403 });
    const { error, lines } = await run([{ repository: 'acme/plan', archived: true }], gh);
    expect(error).toBeUndefined();
    expect(lines).toEqual(['plan archive: acme/plan left as it is: GitHub refused (403): the App needs the administration permission']);
  });

  it('fails the run on a refusal it does not know, for Inngest to retry', async () => {
    const gh = github({ flags: { 'acme/plan': false }, refuse: 502 });
    const { error } = await run([{ repository: 'acme/plan', archived: true }], gh);
    expect(error).toBeDefined();
  });

  it('touches no branch and no pull request: its only write is the repository flag', async () => {
    const gh = github({ flags: { 'acme/plan': false } });
    await run([{ repository: 'acme/plan', archived: true }], gh);
    expect(gh.calls.map((call) => call.route)).toEqual([
      'GET /repos/{owner}/{repo}/installation',
      'GET /repos/{owner}/{repo}',
      'PATCH /repos/{owner}/{repo}',
    ]);
  });

  it('changes nothing, and says so, when the App cannot reach the server or its installations', async () => {
    const lines: string[] = [];
    const fn = createPlanArchive({ client: inngest, octokitFor: () => github({ flags: {} }).octokit, appOctokit: null, store: null, log: (line) => lines.push(line) });
    const { result } = await new InngestTestEngine({ function: fn, events: [{ name: 'inngest/scheduled.timer', data: {} } as never] }).execute();
    expect(result).toEqual({ skipped: 'no store' });
    expect(lines).toHaveLength(1);
  });
});

describe('planArchiveStore — as the service role (PRD 2011 s17)', () => {
  const dbFetch = (rows: unknown, status = 200) => {
    const calls: { method: string; path: string; search: string; key: string | null }[] = [];
    const fetch: typeof globalThis.fetch = (input, init) => {
      const request = input instanceof Request ? input : new Request(String(input), init);
      const url = new URL(request.url);
      calls.push({ method: request.method, path: url.pathname, search: decodeURIComponent(url.search), key: request.headers.get('apikey') });
      return Promise.resolve(new Response(JSON.stringify(rows), { status, headers: { 'content-type': 'application/json' } }));
    };
    return { fetch, calls };
  };

  it('reads each plan repository once, archived only when every product naming it says so', async () => {
    const db = dbFetch([
      { plan_repository: 'Acme/Plan', plan_archived_at: '2026-10-16T09:00:00Z' },
      { plan_repository: 'acme/plan', plan_archived_at: null },
      { plan_repository: 'acme/old', plan_archived_at: '2026-10-16T09:00:00Z' },
    ]);
    const plans = await planArchiveStore({ url: 'https://db.example', key: 'service-key', fetch: db.fetch }).plans();
    expect(plans).toEqual([{ repository: 'acme/old', archived: true }, { repository: 'acme/plan', archived: false }]);
    expect(db.calls).toEqual([expect.objectContaining({ method: 'GET', path: '/rest/v1/products', key: 'service-key' })]);
    expect(db.calls[0]?.search).toContain('plan_repository=not.is.null');
  });

  it('throws on a refusal or an answer out of shape', async () => {
    await expect(planArchiveStore({ url: 'https://db.example', key: 'k', fetch: dbFetch({ message: 'no' }, 400).fetch }).plans()).rejects.toThrow('the database refused');
    await expect(planArchiveStore({ url: 'https://db.example', key: 'k', fetch: dbFetch([{ plan_repository: 'nope', plan_archived_at: null }]).fetch }).plans()).rejects.toThrow();
  });
});
