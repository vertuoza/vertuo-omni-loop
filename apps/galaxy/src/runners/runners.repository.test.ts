import { describe, expect, it } from 'vitest';
import { parsePrd } from 'omni-loop/kit/lib/ids.ts';
import { continuationsRepository, runnersRepository, type RunnersDb } from './runners.repository';
import { jobRow, MO, questionsRow, runnerRow, SHARED, WORKSPACE } from './fixtures/store.fake';

// The runners' storage (PRD 1830 s1): the reads, writes and functions it sends, each answer parsed
// where it comes in. A fake client records each query's chain and answers what the test gives it. The
// claim's own rules, and two runners at once on one job, are proven on the database itself by
// supabase/checks/runners.sql.

type Answer = { data: unknown; error: { code?: string; message?: string } | null };

/** A client whose every query chain is recorded as one line, answered by `answers` in order. */
function fakeDb(answers: Answer[]) {
  const lines: string[] = [];
  const next = () => answers.shift() ?? { data: null, error: { message: 'no answer left' } };
  const chain = (line: string[]): unknown => new Proxy({}, {
    get(_, key: string) {
      if (key === 'then') {
        const answer = next();
        lines.push(line.join('.'));
        return (resolve: (value: Answer) => unknown) => resolve(answer);
      }
      return (...args: unknown[]) => chain([...line, `${key}(${args.map((a) => JSON.stringify(a)).join(',')})`]);
    },
  });
  const db = {
    from: (table: string) => chain([`from(${JSON.stringify(table)})`]),
    rpc: (fn: string, args: Record<string, unknown>) => chain([`rpc(${JSON.stringify(fn)},${JSON.stringify(args)})`]),
  } as unknown as RunnersDb;
  return { db, lines };
}

describe('the claim', () => {
  it('calls runner_claim() and answers the one job it took', async () => {
    const job = jobRow({ status: 'claimed', runner_id: SHARED });
    const { db, lines } = fakeDb([{ data: [job], error: null }]);
    expect(await runnersRepository(db).claim(SHARED)).toEqual(job);
    expect(lines).toEqual([`rpc("runner_claim",{"p_runner":"${SHARED}"})`]);
  });

  it('answers none when another runner won the job', async () => {
    const job = jobRow({ status: 'claimed', runner_id: SHARED });
    // Two claims on one job: the database gives it to one, and the other's call answers no row.
    const { db } = fakeDb([{ data: [job], error: null }, { data: [], error: null }]);
    const repository = runnersRepository(db);
    const claims = await Promise.all([repository.claim(SHARED), repository.claim('00000000-0000-4000-8000-0000018301b1')]);
    expect(claims.filter((claim) => claim !== null)).toEqual([job]);
  });

  it('throws on the database\'s refusal, naming the call', async () => {
    const { db } = fakeDb([{ data: null, error: { code: '42501', message: 'permission denied for function runner_claim' } }]);
    await expect(runnersRepository(db).claim(SHARED)).rejects.toThrow('runner_claim(): permission denied for function runner_claim');
  });

  it('throws on an answer out of shape', async () => {
    const { db } = fakeDb([{ data: [{ id: 1 }], error: null }]);
    await expect(runnersRepository(db).claim(SHARED)).rejects.toThrow('runner_claim() answered out of shape');
  });
});

describe('a lost runner\'s jobs', () => {
  it('are ended by runners_mark_lost() at the cutoff given', async () => {
    const { db, lines } = fakeDb([{ data: 2, error: null }]);
    expect(await runnersRepository(db).markLost('2026-10-13T11:58:30.000Z')).toBe(2);
    expect(lines).toEqual(['rpc("runners_mark_lost",{"p_cutoff":"2026-10-13T11:58:30.000Z"})']);
  });

  it('end a job claimed before the cutoff and still not running, and answer the jobs ended (#2550)', async () => {
    const job = jobRow({ status: 'failed', reason: 'runner lost', runner_id: SHARED, claimed_at: '2026-10-13T11:48:00.000Z', ended_at: '2026-10-13T12:00:00.000Z' });
    const { db, lines } = fakeDb([{ data: [job], error: null }]);
    expect(await runnersRepository(db).loseUnstarted('2026-10-13T11:50:00.000Z', '2026-10-13T12:00:00.000Z')).toEqual([job]);
    expect(lines[0]).toMatch(/^from\("runner_jobs"\)\.update\(\{"status":"failed","reason":"runner lost","ended_at":"2026-10-13T12:00:00.000Z"\}\)\.eq\("status","claimed"\)\.lt\("claimed_at","2026-10-13T11:50:00.000Z"\)\.select\(.*\)$/);
  });
});

describe('the rows', () => {
  it('update a job only while its status is still one of those given', async () => {
    const { db, lines } = fakeDb([{ data: null, error: null }]);
    expect(await runnersRepository(db).updateJob('j1', ['claimed'], { status: 'running' })).toBeNull();
    expect(lines[0]).toMatch(/^from\("runner_jobs"\)\.update\(\{"status":"running"\}\)\.eq\("id","j1"\)\.in\("status",\["claimed"\]\)\.select\(.*\)\.maybeSingle\(\)$/);
  });

  it('read a job\'s outcome with the row, selecting the column, and one out of shape as none (PRD 2223)', async () => {
    const { db, lines } = fakeDb([{ data: jobRow({ status: 'done', outcome: 'held' }), error: null }, { data: { ...jobRow({ status: 'done' }), outcome: 'weird' }, error: null }]);
    const repository = runnersRepository(db);
    expect(await repository.job('j1')).toMatchObject({ outcome: 'held' });
    expect(lines[0]).toContain('outcome');
    expect(await repository.job('j2')).toMatchObject({ outcome: null });
  });

  it('read a job\'s follow-ups with the row, selecting the column, and a list out of shape as none (PRD 2508)', async () => {
    const followUps = [{ repos: ['demo-org/app'], summary: 'One problem the run saw.' }];
    const crooked = { ...jobRow({ status: 'done' }), follow_ups: 'nope' };
    const { db, lines } = fakeDb([{ data: jobRow({ status: 'done', follow_ups: followUps }), error: null }, { data: crooked, error: null }]);
    const repository = runnersRepository(db);
    expect(await repository.job('j1')).toMatchObject({ follow_ups: followUps });
    expect(lines[0]).toContain('follow_ups');
    expect(await repository.job('j2')).toMatchObject({ follow_ups: [] });
  });

  it("read a job's parts with the row, selecting the column, and a list out of shape as none (PRD 2537)", async () => {
    const parts = [{ agent: 'claude', model: 'claude-opus-5-5', account: 'claude-1', from: '2026-10-27T13:41:02.000Z', to: null, ended: null }];
    const crooked = { ...jobRow({ status: 'running' }), parts: [{ agent: 'claude' }] };
    const { db, lines } = fakeDb([{ data: jobRow({ status: 'running', parts }), error: null }, { data: crooked, error: null }]);
    const repository = runnersRepository(db);
    expect(await repository.job('j1')).toMatchObject({ parts });
    expect(lines[0]).toContain('parts');
    expect(await repository.job('j2')).toMatchObject({ parts: null });
  });

  it('read what a bug fix reported and what a key did with the row, selecting the columns, and a value out of shape as none (PRD 2425)', async () => {
    const proved = 'https://github.com/demo-org/app/pull/512';
    const job = jobRow({ status: 'done', outcome: 'already-fixed', fixed_by: proved, prs: ['https://github.com/demo-org/app/pull/549'], acting_for: 'Jane D.', cancelled_by_key: 'k1', cancelled_for: 'Sam' });
    const crooked = { ...jobRow({ status: 'done' }), outcome: 'pr-opened', fixed_by: 12, prs: 'nope', acting_for: 3, cancelled_by_key: {}, cancelled_for: [] };
    const { db, lines } = fakeDb([{ data: job, error: null }, { data: crooked, error: null }]);
    const repository = runnersRepository(db);
    expect(await repository.job('j1')).toMatchObject({ outcome: 'already-fixed', fixed_by: proved, prs: ['https://github.com/demo-org/app/pull/549'], acting_for: 'Jane D.', cancelled_by_key: 'k1', cancelled_for: 'Sam' });
    for (const column of ['fixed_by', 'prs', 'acting_for', 'cancelled_by_key', 'cancelled_for']) expect(lines[0], column).toContain(column);
    expect(await repository.job('j2')).toMatchObject({ outcome: 'pr-opened', fixed_by: null, prs: [], acting_for: null, cancelled_by_key: null, cancelled_for: null });
  });

  it('read every outcome the database keeps, and an unknown word as none (PRD 2425)', async () => {
    const words = ['answers', 'held', 'ready', 'human', 'stopped', 'pr-opened', 'already-fixed', 'needs-brainstorm', 'not-a-bug', 'stuck', 'blocked'];
    const { db } = fakeDb([...words, 'need-human', 'pr_opened'].map((outcome) => ({ data: { ...jobRow({ status: 'done' }), outcome }, error: null })));
    const repository = runnersRepository(db);
    const read: unknown[] = [];
    for (let at = 0; at < words.length + 2; at += 1) read.push((await repository.job(`j${String(at)}`))?.outcome);
    expect(read).toEqual([...words, null, null]);
  });

  it('read the id of the newest job that carries a job on, and none when none does (PRD 2425)', async () => {
    const { db, lines } = fakeDb([{ data: { id: 'j2' }, error: null }, { data: null, error: null }, { data: null, error: { code: '42501', message: 'permission denied for table runner_jobs' } }]);
    const repository = runnersRepository(db);
    expect(await repository.continuedBy('j1')).toBe('j2');
    expect(lines[0]).toBe('from("runner_jobs").select("id").eq("continues","j1").order("queued_at",{"ascending":false}).limit(1).maybeSingle()');
    expect(await repository.continuedBy('j3')).toBeNull();
    await expect(repository.continuedBy('j4')).rejects.toThrow('runner_jobs: permission denied for table runner_jobs');
  });

  it('read a person\'s place in a workspace: owner or member, and their fleet', async () => {
    const { db, lines } = fakeDb([{ data: { role: 'owner' }, error: null }, { data: { team: 'cia', github_login: 'olga' }, error: null }]);
    expect(await runnersRepository(db).member('w1', 'u1')).toEqual({ owner: true, fleet: 'cia' });
    expect(lines).toEqual([
      'from("workspace_members").select("role").eq("workspace_id","w1").eq("user_id","u1").maybeSingle()',
      'from("players").select("team, github_login").eq("workspace_id","w1").eq("user_id","u1").maybeSingle()',
    ]);
    expect(await runnersRepository(fakeDb([{ data: null, error: null }]).db).member('w1', 'u2')).toBeNull();
  });

  it('place a repository with repo_workspace(), or give the database\'s reason', async () => {
    const { db } = fakeDb([{ data: [{ workspace_id: null, refusal: 'you are not a member of Acme, which owns acme/app' }], error: null }]);
    expect(await runnersRepository(db).place('u1', 'acme/app')).toEqual({ workspaceId: null, refusal: 'you are not a member of Acme, which owns acme/app' });
  });

  it('place a repository from the one object PostgREST answers for repo_workspace()', async () => {
    const { db } = fakeDb([{ data: { workspace_id: 'w1', refusal: null }, error: null }]);
    expect(await runnersRepository(db).place('u1', 'acme/app')).toEqual({ workspaceId: 'w1', refusal: null });
  });

  it('insert a runner and a job, and read the logins of those who have one', async () => {
    const runner = runnerRow({ id: SHARED, name: 'shared' });
    const job = jobRow();
    const { db, lines } = fakeDb([{ data: runner, error: null }, { data: job, error: null }, { data: [{ user_id: 'u1', github_login: 'mo' }, { user_id: 'u2', github_login: null }], error: null }]);
    const repository = runnersRepository(db);
    expect(await repository.insertRunner({ workspaceId: 'w1', owner: 'u1', name: 'shared', slots: 1, repos: ['demo-org/app'], version: '1', seenAt: 't', githubApp: true })).toEqual(runner);
    expect(await repository.insertJob({ workspaceId: 'w1', line: '/omni:yolo 1', repo: 'demo-org/app', toRunner: null, toFleet: 'cia', sentBy: 'u1', sentByKey: null })).toEqual(job);
    expect(await repository.logins('w1', ['u1', 'u2'])).toEqual(new Map([['u1', 'mo']]));
    expect(lines[0]).toContain('"github_app":true');
    expect(lines[1]).toContain('"to_fleet":"cia"');
    expect(await repository.logins('w1', [])).toEqual(new Map());
  });
});

describe('several runners at once (PRD 2401 s4)', () => {
  it('are read in one query, none at all when none is asked for', async () => {
    const mo = runnerRow({ id: MO, name: 'mo' });
    const shared = runnerRow({ id: SHARED, name: 'shared' });
    const { db, lines } = fakeDb([{ data: [mo, shared], error: null }]);
    const repository = runnersRepository(db);
    expect(await repository.runnersByIds([MO, SHARED])).toEqual([mo, shared]);
    expect(await repository.runnersByIds([])).toEqual([]);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatch(/^from\("runners"\)\.select\("[^"]+"\)\.in\("id",/);
    expect(lines[0]).toContain(`.in("id",["${MO}","${SHARED}"])`);
  });
});

// A key's GitHub App (PRD 2433 s7): the two service-role functions of
// supabase/migrations/20261228090000_api_key_github_apps.sql, and the runner's `github_app` column.
describe('a key\'s GitHub App (PRD 2433)', () => {
  const OF_JOB = {
    key_id: 'k1', workspace_id: 'w1', working: true, needs_app: true,
    app: { app_id: 123456, slug: 'acme-bugs', bot_id: 777, ciphertext: 'sealed', iv: 'iv' },
    repos: ['demo-org/plan', 'demo-org/api'], product_repos: ['demo-org/api', 'demo-org/plan', 'demo-org/web'],
  };

  it('reads which queued jobs need their key\'s App from key_id and job_id alone, never the sealed key (PRD 2482)', async () => {
    const { db, lines } = fakeDb([{ data: [{ key_id: 'k1' }], error: null }, { data: [{ job_id: 'j3' }], error: null }]);
    const jobs = [{ id: 'j1', keyId: 'k1' }, { id: 'j2', keyId: 'k2' }, { id: 'j3', keyId: 'k2' }];
    expect(await runnersRepository(db).jobsNeedingApp(jobs)).toEqual(new Set(['j1', 'j3']));
    expect(lines).toEqual([
      'from("api_key_github_apps").select("key_id").in("key_id",["k1","k2"])',
      'from("runner_job_needs_app").select("job_id").in("job_id",["j1","j2","j3"])',
    ]);
    expect(await runnersRepository(fakeDb([]).db).jobsNeedingApp([])).toEqual(new Set());
  });

  it('reads the App a job runs as with api_key_github_app_of_job()', async () => {
    const { db, lines } = fakeDb([{ data: OF_JOB, error: null }]);
    expect(await runnersRepository(db).appOfJob('j1')).toEqual(OF_JOB);
    expect(lines).toEqual(['rpc("api_key_github_app_of_job",{"p_job":"j1"})']);
  });

  it('reads a key that holds no App, or has none left, as the database answers it', async () => {
    const { db } = fakeDb([{ data: { ...OF_JOB, app: null, needs_app: false }, error: null }, { data: null, error: null }]);
    const repository = runnersRepository(db);
    expect(await repository.appOfJob('j1')).toEqual({ ...OF_JOB, app: null, needs_app: false });
    expect(await repository.appOfJob('j2')).toBeNull();
  });

  it('refuses an answer out of shape, and says which call', async () => {
    const { db } = fakeDb([{ data: { ...OF_JOB, working: 'yes' }, error: null }]);
    await expect(runnersRepository(db).appOfJob('j1')).rejects.toThrow('api_key_github_app_of_job() answered out of shape');
  });

  it('reads the key\'s allow-list and its job\'s product repositories as the database answers them, an empty list included', async () => {
    const { db } = fakeDb([{ data: { ...OF_JOB, repos: [], product_repos: [] }, error: null }]);
    expect(await runnersRepository(db).appOfJob('j1')).toMatchObject({ repos: [], product_repos: [] });
  });

  it('refuses an answer with no allow-list, which must never read as every repository', async () => {
    const without = { ...OF_JOB, repos: undefined };
    const missing = { ...OF_JOB, product_repos: undefined };
    const { db } = fakeDb([{ data: without, error: null }, { data: missing, error: null }, { data: { ...OF_JOB, repos: null }, error: null }]);
    const repository = runnersRepository(db);
    await expect(repository.appOfJob('j1')).rejects.toThrow('api_key_github_app_of_job() answered out of shape');
    await expect(repository.appOfJob('j2')).rejects.toThrow('api_key_github_app_of_job() answered out of shape');
    await expect(repository.appOfJob('j3')).rejects.toThrow('api_key_github_app_of_job() answered out of shape');
  });

  it('records a mint with api_key_github_app_minted()', async () => {
    const { db, lines } = fakeDb([{ data: null, error: null }]);
    await runnersRepository(db).appMinted('k1');
    expect(lines).toEqual(['rpc("api_key_github_app_minted",{"p_key":"k1"})']);
  });

  it('throws what the database refuses', async () => {
    const { db } = fakeDb([{ data: null, error: { message: 'permission denied' } }]);
    await expect(runnersRepository(db).appMinted('k1')).rejects.toThrow('api_key_github_app_minted(): permission denied');
  });

  it('updates a runner\'s github_app when it registers again', async () => {
    const runner = runnerRow({ id: SHARED, name: 'shared', github_app: false });
    const { db, lines } = fakeDb([{ data: runner, error: null }]);
    await runnersRepository(db).updateRunner(SHARED, { github_app: false });
    expect(lines).toEqual([`from("runners").update({"github_app":false}).eq("id","${SHARED}").select("id, workspace_id, owner, name, fleet, slots, repos, version, last_seen_at, health, github_app").single()`]);
  });
});

describe('a job\'s live lines (PRD 1904)', () => {
  it('are added with on conflict do nothing, so a report sent twice adds nothing', async () => {
    const { db, lines } = fakeDb([{ data: null, error: null }]);
    await runnersRepository(db).appendLines([{ job_id: 'j1', workspace_id: 'w1', seq: 1, text: '12:04:31 Bash: pnpm test' }]);
    expect(lines).toEqual(['from("runner_job_lines").upsert([{"job_id":"j1","workspace_id":"w1","seq":1,"text":"12:04:31 Bash: pnpm test"}],{"onConflict":"job_id,seq","ignoreDuplicates":true})']);
  });

  it('are trimmed up to a sequence number, for the one job', async () => {
    const { db, lines } = fakeDb([{ data: null, error: null }]);
    await runnersRepository(db).trimLines('j1', 2);
    expect(lines).toEqual(['from("runner_job_lines").delete().eq("job_id","j1").lte("seq",2)']);
  });

  it('are kept for the workspace\'s most recent ended jobs by runner_job_lines_retain()', async () => {
    const { db, lines } = fakeDb([{ data: 120, error: null }]);
    expect(await runnersRepository(db).retainLines('w1', 50)).toBe(120);
    expect(lines).toEqual(['rpc("runner_job_lines_retain",{"p_workspace":"w1","p_keep":50})']);
  });

  it('are read after a sequence number, in order, and the first one held', async () => {
    const { db, lines } = fakeDb([{ data: [{ seq: 5, text: 'a' }], error: null }, { data: [{ seq: 3 }], error: null }, { data: [], error: null }]);
    const repository = runnersRepository(db);
    expect(await repository.lines('j1', 4, 5001)).toEqual([{ seq: 5, text: 'a' }]);
    expect(await repository.firstLine('j1')).toBe(3);
    expect(await repository.firstLine('j2')).toBeNull();
    expect(lines.slice(0, 2)).toEqual([
      'from("runner_job_lines").select("seq, text").eq("job_id","j1").gt("seq",4).order("seq").limit(5001)',
      'from("runner_job_lines").select("seq").eq("job_id","j1").order("seq").limit(1)',
    ]);
  });

  it('throw on the database\'s refusal, naming the table', async () => {
    const { db } = fakeDb([{ data: null, error: { message: 'new row violates check constraint' } }]);
    await expect(runnersRepository(db).appendLines([])).rejects.toThrow('runner_job_lines: new row violates check constraint');
  });
});

describe('a job an API key sent (PRD 2022 s4)', () => {
  it('writes the key on the job, and reads the names of the workspace\'s API keys only', async () => {
    const job = jobRow({ sent_by_key: 'k1' });
    const { db, lines } = fakeDb([{ data: job, error: null }, { data: { k1: 'QA dashboard' }, error: null }]);
    const repository = runnersRepository(db);
    expect(await repository.insertJob({ workspaceId: 'w1', line: '/omni:bug-fix x', repo: 'demo-org/app', toRunner: null, toFleet: null, sentBy: 'u1', sentByKey: 'k1' })).toEqual(job);
    expect(lines[0]).toContain('"sent_by_key":"k1"');
    expect(await repository.keyNames('w1', ['k1'])).toEqual(new Map([['k1', 'QA dashboard']]));
    // Through api_key_names(): the service role may not read agent_tokens itself (issue 2165).
    expect(lines[1]).toBe('rpc("api_key_names",{"p_workspace":"w1","p_keys":["k1"]})');
    expect(await repository.keyNames('w1', [])).toEqual(new Map());
  });
});

// A key cancelling and relaunching its job (PRD 2425 s7): the cancel's key and whom it acted for written with the update, the
// relaunch inserted with the job it continues, whom the key acted for and the notify_url it keeps, and none for a job carried on already.
describe('a key cancelling and relaunching its job (PRD 2425 s7)', () => {
  const relaunch = { workspaceId: 'w1', line: '/omni:bug-fix x', repo: 'demo-org/app', toRunner: null, toFleet: 'cia', sentBy: 'u1', sentByKey: 'k1', continues: 'j1', actingFor: 'Jane D.', notifyUrl: 'https://hooks.example.com/omni' };
  const TOO_LATE = { code: '23505', message: 'duplicate key value violates unique constraint "runner_jobs_continues_key"' };

  it('writes the key that cancelled the job and whom it acted for with the update', async () => {
    const job = jobRow({ status: 'cancelled', cancel_requested: true, cancelled_by_key: 'k2', cancelled_for: 'Jane D.' });
    const { db, lines } = fakeDb([{ data: job, error: null }]);
    expect(await runnersRepository(db).updateJob(job.id, ['queued'], { status: 'cancelled', cancel_requested: true, cancelled_by_key: 'k2', cancelled_for: 'Jane D.' })).toEqual(job);
    expect(lines[0]).toContain('.update({"status":"cancelled","cancel_requested":true,"cancelled_by_key":"k2","cancelled_for":"Jane D."})');
    expect(lines[0]).toMatch(/\.select\("[^"]*cancelled_by_key, cancelled_for[^"]*"\)/);
  });

  it('reads the job\'s notify_url, and none for one out of shape', async () => {
    const { db, lines } = fakeDb([{ data: { ...jobRow(), notify_url: 'https://hooks.example.com/omni' }, error: null }, { data: { ...jobRow(), notify_url: 42 }, error: null }]);
    const repository = runnersRepository(db);
    expect((await repository.job('j1'))?.notify_url).toBe('https://hooks.example.com/omni');
    expect((await repository.job('j1'))?.notify_url).toBeNull();
    expect(lines[0]).toMatch(/\.select\("[^"]*acting_for, notify_url, cancelled_by_key[^"]*"\)/);
  });

  it('inserts the relaunch as the key and its maker, with the job it continues, whom the key acted for and the notify_url', async () => {
    const queued = jobRow({ line: '/omni:bug-fix x', continues: 'j1', sent_by_key: 'k1' });
    const { db, lines } = fakeDb([{ data: queued, error: null }]);
    expect(await runnersRepository(db).insertRelaunch(relaunch)).toEqual(queued);
    expect(lines[0]).toMatch(/^from\("runner_jobs"\)\.insert\(\{.*\}\)\.select\(".*"\)\.single\(\)$/);
    for (const written of ['"sent_by":"u1"', '"sent_by_key":"k1"', '"continues":"j1"', '"to_fleet":"cia"', '"acting_for":"Jane D."', '"notify_url":"https://hooks.example.com/omni"']) {
      expect(lines[0]).toContain(written);
    }
  });

  it('writes none for whom the key acted for and the notify_url when there is none', async () => {
    const { db, lines } = fakeDb([{ data: jobRow({ continues: 'j1' }), error: null }]);
    await runnersRepository(db).insertRelaunch({ ...relaunch, actingFor: null, notifyUrl: null });
    expect(lines[0]).toContain('"acting_for":null,"notify_url":null');
  });

  it('answers none when the job was carried on already, and throws on any other refusal, naming the table', async () => {
    const lost = fakeDb([{ data: null, error: TOO_LATE }]);
    expect(await runnersRepository(lost.db).insertRelaunch(relaunch)).toBeNull();
    const refused = fakeDb([{ data: null, error: { code: '42501', message: 'permission denied for table runner_jobs' } }]);
    await expect(runnersRepository(refused.db).insertRelaunch(relaunch)).rejects.toThrow('runner_jobs: permission denied for table runner_jobs');
  });

  it('leaves the continuation\'s insert as it was, with no acting_for and no notify_url', async () => {
    const { db, lines } = fakeDb([{ data: jobRow({ continues: 'j1' }), error: null }]);
    await continuationsRepository(db).insertContinuation({ workspaceId: 'w1', line: '/omni:yolo-fix 1', repo: 'demo-org/app', toRunner: null, toFleet: null, sentBy: 'u1', sentByKey: null, continues: 'j1' });
    expect(lines[0]).toContain('.insert({"workspace_id":"w1","line":"/omni:yolo-fix 1","repo":"demo-org/app","to_runner":null,"to_fleet":null,"sent_by":"u1","sent_by_key":null,"continues":"j1"})');
  });
});

// A key's start and the jobs that carry it on (PRD 2425 s8): the job stores whom the key acts for and the link as given, and only
// when they are given; a continuation that stays a key's job writes the link with its insert.
describe('a key starting a job that pings a link (PRD 2425 s8)', () => {
  const start = { workspaceId: 'w1', line: '/omni:bug-fix x', repo: 'demo-org/app', toRunner: null, toFleet: null, sentBy: 'u1', sentByKey: 'k1' };
  const fix = { workspaceId: 'w1', line: '/omni:yolo-fix 1', repo: 'demo-org/app', toRunner: null, toFleet: null, sentBy: 'u1', sentByKey: 'k1', continues: 'j1' };
  const LINK = 'https://hooks.example.com/omni';

  it('writes whom the key acts for and the link with the job, as given', async () => {
    const job = jobRow({ sent_by_key: 'k1' });
    const { db, lines } = fakeDb([{ data: job, error: null }]);
    expect(await runnersRepository(db).insertJob({ ...start, actingFor: 'Jane D.', notifyUrl: LINK })).toEqual(job);
    expect(lines[0]).toContain(`"sent_by_key":"k1","acting_for":"Jane D.","notify_url":"${LINK}"`);
  });

  it('writes one without the other, and neither when the start gives neither', async () => {
    const { db, lines } = fakeDb([{ data: jobRow(), error: null }, { data: jobRow(), error: null }, { data: jobRow(), error: null }]);
    const repository = runnersRepository(db);
    await repository.insertJob({ ...start, notifyUrl: LINK });
    await repository.insertJob({ ...start, actingFor: 'Jane D.' });
    await repository.insertJob({ ...start, actingFor: undefined, notifyUrl: undefined });
    expect(lines[0]).toContain(`"sent_by_key":"k1","notify_url":"${LINK}"})`);
    expect(lines[0]).not.toContain('"acting_for":');
    expect(lines[1]).toContain('"sent_by_key":"k1","acting_for":"Jane D."})');
    expect(lines[1]).not.toContain('"notify_url":');
    expect(lines[2]).toContain('.insert({"workspace_id":"w1","line":"/omni:bug-fix x","repo":"demo-org/app","to_runner":null,"to_fleet":null,"sent_by":"u1","sent_by_key":"k1"})');
  });

  it('writes the link of a continuation that stays a key\'s job with its insert, and nothing else new', async () => {
    const { db, lines } = fakeDb([{ data: jobRow({ continues: 'j1' }), error: null }]);
    await continuationsRepository(db).insertContinuation({ ...fix, notifyUrl: LINK });
    expect(lines[0]).toContain(`"sent_by_key":"k1","continues":"j1","notify_url":"${LINK}"})`);
    expect(lines[0]).not.toContain('"acting_for":');
  });
});

describe('a repository\'s allowed skills (PRD 2313)', () => {
  it('are read by repository_runner_skills_of(), for the workspace and the repository', async () => {
    const { db, lines } = fakeDb([{ data: ['audit', 'validate-prd'], error: null }, { data: [], error: null }]);
    const repository = runnersRepository(db);
    expect(await repository.allowedSkills('w1', 'acme/widgets')).toEqual(['audit', 'validate-prd']);
    expect(await repository.allowedSkills('w1', 'acme/other')).toEqual([]);
    expect(lines[0]).toBe('rpc("repository_runner_skills_of",{"p_workspace":"w1","p_full_name":"acme/widgets"})');
  });

  it('throw on the database\'s refusal or an answer out of shape, naming the call', async () => {
    const refused = fakeDb([{ data: null, error: { message: 'permission denied' } }]);
    await expect(runnersRepository(refused.db).allowedSkills('w1', 'acme/widgets')).rejects.toThrow('repository_runner_skills_of(): permission denied');
    const odd = fakeDb([{ data: [1], error: null }]);
    await expect(runnersRepository(odd.db).allowedSkills('w1', 'acme/widgets')).rejects.toThrow('repository_runner_skills_of() answered out of shape');
  });
});

// A job continued once its answers are in (PRD 2270 s1): the switch read per repository, the PRD's jobs
// cut by their line, and a continuation the unique index refuses answered as none.
describe('a continuation (PRD 2270)', () => {
  it('reads the repository\'s switch, and none for a repository the workspace does not list', async () => {
    const { db, lines } = fakeDb([{ data: { fix_when_answered: false }, error: null }, { data: null, error: null }]);
    const repository = continuationsRepository(db);
    expect(await repository.fixWhenAnswered('w1', 'demo-org/app')).toBe(false);
    expect(await repository.fixWhenAnswered('w1', 'demo-org/gone')).toBeNull();
    expect(lines[0]).toBe('from("repositories").select("fix_when_answered").eq("workspace_id","w1").eq("full_name","demo-org/app").maybeSingle()');
  });

  it('reads the repository\'s jobs whose line may name the PRD, newest first, with what each continues', async () => {
    const job = jobRow({ status: 'done', outcome: 'answers' });
    const { db, lines } = fakeDb([{ data: [{ ...job, continues: null }], error: null }, { data: [{ ...job, continues: 42 }], error: null }]);
    const repository = continuationsRepository(db);
    expect(await repository.prdJobs('w1', 'demo-org/app', parsePrd(2270))).toEqual([{ ...job, continues: null }]);
    expect(lines[0]).toMatch(/^from\("runner_jobs"\)\.select\(".*continues.*"\)\.eq\("workspace_id","w1"\)\.eq\("repo","demo-org\/app"\)\.like\("line","\/omni:% 2270%"\)\.order\("queued_at",\{"ascending":false\}\)\.limit\(50\)$/);
    // A link out of shape reads as none.
    expect((await repository.prdJobs('w1', 'demo-org/app', parsePrd(2270)))[0]?.continues).toBeNull();
  });

  it('inserts the continuation with the job it continues, and answers none when the job was continued already', async () => {
    const fix = jobRow({ line: '/omni:yolo-fix 2270', continues: 'j1' });
    const { db, lines } = fakeDb([{ data: fix, error: null }, { data: null, error: { code: '23505', message: 'duplicate key value violates unique constraint "runner_jobs_continues_key"' } }]);
    const repository = continuationsRepository(db);
    const continuation = { workspaceId: 'w1', line: '/omni:yolo-fix 2270', repo: 'demo-org/app', toRunner: null, toFleet: 'cia', sentBy: 'u1', sentByKey: null, continues: 'j1' };
    expect(await repository.insertContinuation(continuation)).toEqual(fix);
    expect(lines[0]).toContain('"continues":"j1"');
    expect(lines[0]).toContain('"to_fleet":"cia"');
    expect(await repository.insertContinuation(continuation)).toBeNull();
  });

  it('throws on any other refusal, naming the table', async () => {
    const { db } = fakeDb([{ data: null, error: { code: '42501', message: 'permission denied for table runner_jobs' } }]);
    await expect(continuationsRepository(db).insertContinuation({ workspaceId: 'w1', line: '/omni:yolo-fix 1', repo: 'demo-org/app', toRunner: null, toFleet: null, sentBy: 'u1', sentByKey: null, continues: 'j1' }))
      .rejects.toThrow('runner_jobs: permission denied for table runner_jobs');
  });
});

// A runner's health and samples (PRD 2102 s1): the snapshot read with the runner, out of shape as none;
// a sample added once per runner and instant, trimmed by runner and time, read oldest first.
describe('a runner\'s health and samples', () => {
  const sample = { runner_id: SHARED, workspace_id: 'w1', at: '2026-10-16T12:00:00.000Z', cpu: 63.5, mem_used: 1, mem_total: 2, disk_free: 3, tokens_5h: null };

  it('reads the runner\'s last health with it, and one out of shape as none', async () => {
    const health = { cpu: 63.5, load1: 7.9, cores: 8, memUsed: 1, memTotal: 2, diskFree: 3, diskTotal: 4, at: '2026-10-16T12:00:00.000Z' };
    const { db, lines } = fakeDb([{ data: runnerRow({ id: SHARED, name: 'shared', health }), error: null }, { data: { ...runnerRow({ id: SHARED, name: 'shared' }), health: { cpu: 'high' } }, error: null }]);
    const repository = runnersRepository(db);
    expect((await repository.runner(SHARED))?.health).toEqual(health);
    expect((await repository.runner(SHARED))?.health).toBeNull();
    expect(lines[0]).toContain('last_seen_at, health');
  });

  it('adds a sample once per runner and instant', async () => {
    const { db, lines } = fakeDb([{ data: null, error: null }]);
    await runnersRepository(db).insertSample(sample);
    expect(lines).toEqual([`from("runner_samples").upsert(${JSON.stringify(sample)},{"onConflict":"runner_id,at","ignoreDuplicates":true})`]);
  });

  it('deletes the runner\'s samples taken before a time', async () => {
    const { db, lines } = fakeDb([{ data: null, error: null }]);
    await runnersRepository(db).trimSamples(SHARED, '2026-10-16T11:00:00.000Z');
    expect(lines).toEqual([`from("runner_samples").delete().eq("runner_id","${SHARED}").lt("at","2026-10-16T11:00:00.000Z")`]);
  });

  it('reads the runners\' samples since a time, oldest first, and asks nothing for no runner', async () => {
    const { db, lines } = fakeDb([{ data: [sample], error: null }]);
    const repository = runnersRepository(db);
    expect(await repository.samples([SHARED], '2026-10-16T11:00:00.000Z')).toEqual([sample]);
    expect(lines).toEqual([`from("runner_samples").select("runner_id, workspace_id, at, cpu, mem_used, mem_total, disk_free, tokens_5h").in("runner_id",["${SHARED}"]).gte("at","2026-10-16T11:00:00.000Z").order("at")`]);
    expect(await repository.samples([], '2026-10-16T11:00:00.000Z')).toEqual([]);
    expect(lines).toHaveLength(1);
  });

  it('throws on the database\'s refusal, naming the table', async () => {
    const { db } = fakeDb([{ data: null, error: { message: 'permission denied for table runner_samples' } }]);
    await expect(runnersRepository(db).insertSample(sample)).rejects.toThrow('runner_samples: permission denied for table runner_samples');
  });
});

// A job's questions (PRD 2255 s1): the row stored once per job, read by job and by workspace, and the two
// functions that close it, called with every argument and refused by the code the database raises. What
// the functions do is proven on the database itself by supabase/checks/runner_job_questions.sql.
describe('a job\'s questions (PRD 2255)', () => {
  const JOB = '00000000-0000-4000-8000-0000022552a1';
  const row = questionsRow({ job_id: JOB });
  const answers = { 'Which fix?': 'Guard the input' };

  it('stores the questions a job asks, with its workspace, issue and lead, and answers the row', async () => {
    const { db, lines } = fakeDb([{ data: row, error: null }]);
    const stored = await runnersRepository(db).insertQuestions({ jobId: JOB, workspaceId: WORKSPACE, issue: row.issue, lead: row.lead, questions: row.questions });
    expect(stored).toEqual(row);
    expect(lines).toEqual([`from("runner_job_questions").insert(${JSON.stringify({ job_id: JOB, workspace_id: WORKSPACE, issue: 314, lead: row.lead, questions: row.questions })}).select("job_id, workspace_id, issue, lead, questions, answers, closed_by, closed_by_key, closed_for, closed_at, resume_job, asked_at").single()`]);
  });

  it('answers none when the job asked already (one row per job: the primary key refuses a second)', async () => {
    const { db } = fakeDb([{ data: null, error: { code: '23505', message: 'duplicate key value violates unique constraint "runner_job_questions_pkey"' } }]);
    expect(await runnersRepository(db).insertQuestions({ jobId: JOB, workspaceId: WORKSPACE, issue: row.issue, lead: row.lead, questions: row.questions })).toBeNull();
  });

  it('throws on any other refusal when it stores, naming the table', async () => {
    const { db } = fakeDb([{ data: null, error: { code: '23514', message: 'new row violates check constraint "runner_job_questions_questions_check"' } }]);
    await expect(runnersRepository(db).insertQuestions({ jobId: JOB, workspaceId: WORKSPACE, issue: row.issue, lead: row.lead, questions: row.questions }))
      .rejects.toThrow('runner_job_questions: new row violates check constraint');
  });

  it('reads a job\'s questions by the job, and none for a job that asked none', async () => {
    const { db, lines } = fakeDb([{ data: row, error: null }, { data: null, error: null }]);
    const repository = runnersRepository(db);
    expect(await repository.questionsOf(JOB)).toEqual(row);
    expect(await repository.questionsOf('00000000-0000-4000-8000-0000022552b1')).toBeNull();
    expect(lines[0]).toBe(`from("runner_job_questions").select("job_id, workspace_id, issue, lead, questions, answers, closed_by, closed_by_key, closed_for, closed_at, resume_job, asked_at").eq("job_id","${JOB}").maybeSingle()`);
  });

  it('reads a closed row with its answers, who closed it and the resume job', async () => {
    const closed = questionsRow({ job_id: JOB, answers, closed_by: MO, closed_at: '2026-10-13T12:05:00.000Z', resume_job: '00000000-0000-4000-8000-0000022552c1' });
    const { db } = fakeDb([{ data: closed, error: null }]);
    expect(await runnersRepository(db).questionsOf(JOB)).toEqual(closed);
  });

  it('reads the key that closed a round and whom it acted for (PRD 2425), and never fails on a value out of shape there', async () => {
    const byKey = questionsRow({ job_id: JOB, answers, closed_by_key: '00000000-0000-4000-8000-0000018302a2', closed_for: 'Jane D.', closed_at: '2026-10-13T12:05:00.000Z' });
    expect(await runnersRepository(fakeDb([{ data: byKey, error: null }]).db).questionsOf(JOB)).toMatchObject({ closed_by_key: byKey.closed_by_key, closed_for: 'Jane D.' });
    const odd = await runnersRepository(fakeDb([{ data: { ...byKey, closed_by_key: 7, closed_for: ['x'] }, error: null }]).db).questionsOf(JOB);
    expect(odd).toMatchObject({ closed_by_key: null, closed_for: null });
  });

  it('throws on a row whose questions are out of shape', async () => {
    const { db } = fakeDb([{ data: { ...row, questions: [{ question: 'Which fix?' }] }, error: null }]);
    await expect(runnersRepository(db).questionsOf(JOB)).rejects.toThrow('runner_job_questions answered out of shape');
  });

  it('lists the workspace\'s jobs whose questions are open, by the workspace', async () => {
    const { db, lines } = fakeDb([{ data: [{ job_id: JOB }, { job_id: 'j2' }], error: null }]);
    expect(await runnersRepository(db).openQuestionJobs(WORKSPACE)).toEqual([JOB, 'j2']);
    expect(lines).toEqual([`from("runner_job_questions").select("job_id").eq("workspace_id","${WORKSPACE}").is("closed_at",null)`]);
  });

  it('reads the workspace\'s jobs among some ids, newest ended first, and asks nothing for none', async () => {
    const job = jobRow({ status: 'done', outcome: 'human', ended_at: '2026-10-13T12:00:00.000Z' });
    const { db, lines } = fakeDb([{ data: [job], error: null }]);
    const repository = runnersRepository(db);
    expect(await repository.jobsById(WORKSPACE, [job.id])).toEqual([job]);
    expect(lines).toEqual([expect.stringContaining(`.eq("workspace_id","${WORKSPACE}").in("id",["${job.id}"]).order("ended_at",{"ascending":false})`)]);
    expect(await repository.jobsById(WORKSPACE, [])).toEqual([]);
    expect(lines).toHaveLength(1);
  });

  it('reads a job that ended with its questions open, outcome human', async () => {
    const { db } = fakeDb([{ data: jobRow({ status: 'done', outcome: 'human' }), error: null }]);
    expect((await runnersRepository(db).job('j1'))?.outcome).toBe('human');
  });

  it('answers a job\'s questions through runner_job_answer(), with the job, the answers and who answers, and reads the resume job', async () => {
    const resume = jobRow({ line: `/omni:bug-fix #314 --answers ${JOB}`, sent_by: MO });
    const { db, lines } = fakeDb([{ data: resume, error: null }, { data: [resume], error: null }]);
    const repository = runnersRepository(db);
    expect(await repository.answer(JOB, answers, MO)).toEqual({ ok: true, value: resume });
    // A function that returns one row may be answered as a list of one.
    expect(await repository.answer(JOB, answers, MO)).toEqual({ ok: true, value: resume });
    expect(lines[0]).toBe(`rpc("runner_job_answer",${JSON.stringify({ p_job: JOB, p_answers: answers, p_by: MO })})`);
  });

  it('dismisses a job\'s questions through runner_job_dismiss(), with the job and who dismisses, and reads the closed row', async () => {
    const closed = questionsRow({ job_id: JOB, closed_by: MO, closed_at: '2026-10-13T12:05:00.000Z' });
    const { db, lines } = fakeDb([{ data: closed, error: null }]);
    expect(await runnersRepository(db).dismiss(JOB, MO)).toEqual({ ok: true, value: closed });
    expect(lines).toEqual([`rpc("runner_job_dismiss",${JSON.stringify({ p_job: JOB, p_by: MO })})`]);
  });

  it.each([
    ['P0002', 'no questions on this job', 'none'],
    ['55000', 'these questions are already closed', 'closed'],
    ['55000', 'this job is not waiting for an answer', 'closed'],
    ['42501', 'not a member of this workspace', 'stranger'],
    ['22023', 'each question needs one answer', 'mismatch'],
  ] as const)('reads the database\'s refusal %s (%s) as %s, for an answer and for a dismissal', async (code, message, refusal) => {
    const { db } = fakeDb([{ data: null, error: { code, message } }, { data: null, error: { code, message } }]);
    const repository = runnersRepository(db);
    expect(await repository.answer(JOB, answers, MO)).toEqual({ ok: false, refusal });
    expect(await repository.dismiss(JOB, MO)).toEqual({ ok: false, refusal });
  });

  describe('closed by an API key (PRD 2425 s6)', () => {
    const KEY = '00000000-0000-4000-8000-0000018302a1';

    it('answers through runner_job_answer() with the key and whom it acted for, and no person', async () => {
      const resume = jobRow({ line: `/omni:bug-fix #314 --answers ${JOB}`, sent_by: MO, sent_by_key: KEY, continues: JOB, acting_for: 'Jane D.' });
      const { db, lines } = fakeDb([{ data: resume, error: null }, { data: [resume], error: null }]);
      const repository = runnersRepository(db);
      expect(await repository.answerByKey(JOB, answers, KEY, 'Jane D.')).toEqual({ ok: true, value: resume });
      expect(await repository.answerByKey(JOB, answers, KEY, null)).toEqual({ ok: true, value: resume });
      expect(lines[0]).toBe(`rpc("runner_job_answer",${JSON.stringify({ p_job: JOB, p_answers: answers, p_key: KEY, p_acting_for: 'Jane D.' })})`);
      expect(lines[1]).toBe(`rpc("runner_job_answer",${JSON.stringify({ p_job: JOB, p_answers: answers, p_key: KEY, p_acting_for: null })})`);
    });

    it('dismisses through runner_job_dismiss() with the key and whom it acted for, and no person', async () => {
      const closed = questionsRow({ job_id: JOB, closed_by_key: KEY, closed_for: 'Jane D.', closed_at: '2026-10-13T12:05:00.000Z' });
      const { db, lines } = fakeDb([{ data: closed, error: null }]);
      expect(await runnersRepository(db).dismissByKey(JOB, KEY, 'Jane D.')).toEqual({ ok: true, value: closed });
      expect(lines).toEqual([`rpc("runner_job_dismiss",${JSON.stringify({ p_job: JOB, p_key: KEY, p_acting_for: 'Jane D.' })})`]);
    });

    it.each([
      ['42501', 'an API key closes only the questions of a job an API key sent'],
      ['42501', 'this API key does not act on this job'],
    ] as const)('reads the database\'s refusal %s (%s) as the key being refused, for an answer and for a dismissal', async (code, message) => {
      const { db } = fakeDb([{ data: null, error: { code, message } }, { data: null, error: { code, message } }]);
      const repository = runnersRepository(db);
      expect(await repository.answerByKey(JOB, answers, KEY, null)).toEqual({ ok: false, refusal: 'key' });
      expect(await repository.dismissByKey(JOB, KEY, null)).toEqual({ ok: false, refusal: 'key' });
    });

    it('reads the same refusals of a closed round, or none, as a person meets them', async () => {
      const { db } = fakeDb([
        { data: null, error: { code: '55000', message: 'these questions are already closed' } },
        { data: null, error: { code: 'P0002', message: 'no questions on this job' } },
      ]);
      const repository = runnersRepository(db);
      expect(await repository.answerByKey(JOB, answers, KEY, null)).toEqual({ ok: false, refusal: 'closed' });
      expect(await repository.dismissByKey(JOB, KEY, null)).toEqual({ ok: false, refusal: 'none' });
    });

    it('throws on any other failure, naming the function', async () => {
      const { db } = fakeDb([{ data: null, error: { code: '42501', message: 'permission denied for function runner_job_answer' } }]);
      await expect(runnersRepository(db).answerByKey(JOB, answers, KEY, null)).rejects.toThrow('runner_job_answer(): permission denied for function runner_job_answer');
    });
  });

  it('throws on any other failure, naming the function: a permission denied is not a stranger', async () => {
    const { db } = fakeDb([
      { data: null, error: { code: '42501', message: 'permission denied for function runner_job_answer' } },
      { data: null, error: { code: '23514', message: 'new row for relation "runner_jobs" violates check constraint "runner_jobs_line_check"' } },
    ]);
    const repository = runnersRepository(db);
    await expect(repository.answer(JOB, answers, MO)).rejects.toThrow('runner_job_answer(): permission denied for function runner_job_answer');
    await expect(repository.dismiss(JOB, MO)).rejects.toThrow('runner_job_dismiss(): new row for relation "runner_jobs" violates check constraint');
  });

  it('throws on an answer out of shape', async () => {
    const { db } = fakeDb([{ data: { id: 1 }, error: null }, { data: [], error: null }]);
    const repository = runnersRepository(db);
    await expect(repository.answer(JOB, answers, MO)).rejects.toThrow('runner_job_answer() answered out of shape');
    await expect(repository.dismiss(JOB, MO)).rejects.toThrow('runner_job_dismiss() answered out of shape');
  });
});
