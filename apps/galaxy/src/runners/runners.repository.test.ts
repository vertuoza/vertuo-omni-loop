import { describe, expect, it } from 'vitest';
import { runnersRepository, type RunnersDb } from './runners.repository';
import { jobRow, runnerRow, SHARED } from './fixtures/store.fake';

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
});

describe('the rows', () => {
  it('update a job only while its status is still one of those given', async () => {
    const { db, lines } = fakeDb([{ data: null, error: null }]);
    expect(await runnersRepository(db).updateJob('j1', ['claimed'], { status: 'running' })).toBeNull();
    expect(lines[0]).toMatch(/^from\("runner_jobs"\)\.update\(\{"status":"running"\}\)\.eq\("id","j1"\)\.in\("status",\["claimed"\]\)\.select\(.*\)\.maybeSingle\(\)$/);
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
    expect(await repository.insertRunner({ workspaceId: 'w1', owner: 'u1', name: 'shared', slots: 1, repos: ['vertuoza/app'], version: '1', seenAt: 't' })).toEqual(runner);
    expect(await repository.insertJob({ workspaceId: 'w1', line: '/omni:yolo 1', repo: 'vertuoza/app', toRunner: null, toFleet: 'cia', sentBy: 'u1', sentByKey: null })).toEqual(job);
    expect(await repository.logins('w1', ['u1', 'u2'])).toEqual(new Map([['u1', 'mo']]));
    expect(lines[1]).toContain('"to_fleet":"cia"');
    expect(await repository.logins('w1', [])).toEqual(new Map());
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
    const { db, lines } = fakeDb([{ data: job, error: null }, { data: [{ id: 'k1', name: 'QA dashboard' }], error: null }]);
    const repository = runnersRepository(db);
    expect(await repository.insertJob({ workspaceId: 'w1', line: '/omni:bug-fix x', repo: 'vertuoza/app', toRunner: null, toFleet: null, sentBy: 'u1', sentByKey: 'k1' })).toEqual(job);
    expect(lines[0]).toContain('"sent_by_key":"k1"');
    expect(await repository.keyNames('w1', ['k1'])).toEqual(new Map([['k1', 'QA dashboard']]));
    expect(lines[1]).toContain('.eq("workspace_id","w1").eq("scope","api").in("id",["k1"])');
    expect(await repository.keyNames('w1', [])).toEqual(new Map());
  });
});
