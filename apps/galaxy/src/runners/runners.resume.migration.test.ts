// The resume's migration (PRD 2809 s1), read as text, as runners.skills.migration.test.ts reads its own: the
// database's list of resumable skills is the kit's RESUMABLE_SKILLS, the reasons it reads as a loss are the
// words the routes and the runner write, the claim waits for a resume's resume_after, and the database's types
// name the three columns. What the rows do is proven on a database by supabase/checks/runner_resume.sql.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { RESUMABLE_SKILLS, RUNNABLE_SKILLS } from 'omni-loop/kit/lib/runner/line.ts';

const read = (path: string) => readFileSync(fileURLToPath(new URL(`../../../../${path}`, import.meta.url)), 'utf8');
const MIGRATION = read('supabase/migrations/20270121100000_runner_resume.sql');
const CODE = MIGRATION.replace(/--.*$/gm, '').replace(/\s+/g, ' ');
const TYPES = read('supabase/database.types.ts');

/** The body of a function the migration creates, from its `create … function` to its closing `$$;`. */
function body(name: string): string {
  const match = new RegExp(`create (?:or replace )?function public\\.${name}\\(.*?\\$\\$(.*?)\\$\\$;`).exec(CODE);
  if (!match?.[1]) throw new Error(`no function ${name}`);
  return match[1];
}

/** The quoted words of the first `array[…]` in `text`, in order. */
function arrayWords(text: string): string[] {
  const list = /array\[([^\]]*)\]/.exec(text)?.[1] ?? '';
  return [...list.matchAll(/'([^']*)'/g)].map((word) => word[1] ?? '');
}

describe('runner_jobs: resumes, attempt and resume_after', () => {
  it('adds a unique resumes that goes null with its job, an attempt of 1 to 3, 1 by default, and a wait', () => {
    expect(CODE).toContain('add column resumes uuid unique references public.runner_jobs (id) on delete set null');
    expect(CODE).toContain('add column attempt smallint not null default 1 check (attempt between 1 and 3)');
    expect(CODE).toContain('add column resume_after timestamptz,');
    expect(CODE).toContain('add constraint runner_jobs_resume_shape check (resumes is null or attempt > 1)');
  });

  it('is named in the database\'s types, which the migrations generate', () => {
    const row = /runner_jobs: \{\s*Row: \{([^}]*)\}/.exec(TYPES)?.[1] ?? '';
    expect(row).toContain('attempt: number');
    expect(row).toContain('resumes: string | null');
    expect(row).toContain('resume_after: string | null');
    expect(TYPES).toContain('foreignKeyName: "runner_jobs_resumes_fkey"');
  });
});

describe('runner_job_resume_lost(), the trigger that queues a resume', () => {
  const fn = body('runner_job_resume_lost');

  it('resumes the kit\'s RESUMABLE_SKILLS exactly, each one a skill a runner runs', () => {
    expect(arrayWords(fn)).toEqual([...RESUMABLE_SKILLS]);
    for (const skill of arrayWords(fn)) expect(RUNNABLE_SKILLS).toContain(skill);
  });

  it('reads the skill of a fixed line only, so a repository\'s own skill is never resumed', () => {
    expect(fn).toContain("skill text := substring(new.line from '^/omni:([a-z][a-z-]*)');");
  });

  it('queues nothing from the third attempt on, for a job whose cancel was asked, or a skill not listed', () => {
    expect(fn).toContain('if new.attempt >= 3 or new.cancel_requested or skill is null or not (skill = any (array[');
  });

  it('queues the same line, repository, sender and target, resuming the lost job, one attempt on, after 1 then 5 minutes', () => {
    expect(fn).toContain(
      'insert into public.runner_jobs (workspace_id, line, repo, to_runner, to_fleet, sent_by, sent_by_app, sent_by_key, acting_for, notify_url, resumes, attempt, resume_after) '
      + 'values (new.workspace_id, new.line, new.repo, new.to_runner, new.to_fleet, new.sent_by, new.sent_by_app, new.sent_by_key, new.acting_for, new.notify_url, '
      + "new.id, new.attempt + 1, now() + case when new.attempt = 1 then interval '1 minute' else interval '5 minutes' end) on conflict (resumes) do nothing;",
    );
  });

  it('runs as its owner, under an empty search path, and nobody may call it', () => {
    expect(CODE).toContain("create function public.runner_job_resume_lost() returns trigger language plpgsql security definer set search_path = ''");
    expect(CODE).toContain('revoke execute on function public.runner_job_resume_lost() from public, anon, authenticated, service_role;');
  });

  it('fires on a claimed or running job that ends failed with a loss\'s reason, and no other', () => {
    expect(CODE).toContain(
      "create trigger runner_jobs_resume_lost after update of status on public.runner_jobs for each row when ( new.status = 'failed' and old.status in ('claimed', 'running') "
      + "and new.reason in ('runner lost', 'the worktree could not be made', 'the tmux session could not be started') ) execute function public.runner_job_resume_lost();",
    );
  });

  it('reads the words the routes and the runner write for a loss', () => {
    const service = read('apps/galaxy/src/runners/runners.service.ts');
    const repository = read('apps/galaxy/src/runners/runners.repository.ts');
    const runner = read('kit/lib/runner/runner.ts');
    const lostFromSilence = read('supabase/migrations/20261207100000_runners.sql');
    expect(service).toContain("{ status: 'failed', reason: 'runner lost', ended_at: iso() }");
    expect(repository).toContain("update({ status: 'failed', reason: 'runner lost', ended_at: at })");
    expect(lostFromSilence).toContain("set status = 'failed', reason = 'runner lost', ended_at = now()");
    expect(runner).toContain("{ status: 'failed', reason: 'the worktree could not be made' }");
    expect(runner).toContain("{ status: 'failed', reason: 'the tmux session could not be started' }");
  });
});

describe('a provider limit\'s wait (PRD 2949, 20270125120000_runner_limit_waits.sql)', () => {
  const LIMIT = read('supabase/migrations/20270125120000_runner_limit_waits.sql');
  const code = LIMIT.replace(/--.*$/gm, '').replace(/\s+/g, ' ');
  const limitBody = (name: string): string => {
    const match = new RegExp(`create (?:or replace )?function public\\.${name}\\(.*?\\$\\$(.*?)\\$\\$;`).exec(code);
    if (!match?.[1]) throw new Error(`no function ${name}`);
    return match[1];
  };

  it('adds limited_until, waits of 0 to 6, 0 by default, and lets a resume keep its try once it waited', () => {
    expect(code).toContain('add column limited_until timestamptz,');
    expect(code).toContain('add column waits smallint not null default 0 check (waits between 0 and 6),');
    expect(code).toContain('add constraint runner_jobs_resume_shape check (resumes is null or attempt > 1 or waits > 0);');
    const row = /runner_jobs: \{\s*Row: \{([^}]*)\}/.exec(TYPES)?.[1] ?? '';
    expect(row).toContain('limited_until: string | null');
    expect(row).toContain('waits: number');
  });

  it('keeps a lost job\'s resume as it was, its skills and its tries, carrying the chain\'s waits', () => {
    const lost = limitBody('runner_job_resume_lost');
    expect(arrayWords(lost)).toEqual([...RESUMABLE_SKILLS]);
    expect(lost).toContain('if new.attempt >= 3 or new.cancel_requested or skill is null or not (skill = any (array[');
    expect(lost).toContain("new.id, new.attempt + 1, new.waits, now() + case when new.attempt = 1 then interval '1 minute' else interval '5 minutes' end) on conflict (resumes) do nothing;");
  });

  it('queues for a limit, unless a cancel was asked, the same line, sender and target, the same try, one wait on, at the reset', () => {
    const waits = limitBody('runner_job_resume_limited');
    expect(waits).toContain('if new.cancel_requested then return null; end if;');
    expect(waits).toContain(
      'insert into public.runner_jobs (workspace_id, line, repo, to_runner, to_fleet, sent_by, sent_by_app, sent_by_key, acting_for, notify_url, resumes, attempt, waits, resume_after) '
      + 'values (new.workspace_id, new.line, new.repo, new.to_runner, new.to_fleet, new.sent_by, new.sent_by_app, new.sent_by_key, new.acting_for, new.notify_url, '
      + 'new.id, new.attempt, new.waits + 1, new.limited_until) on conflict (resumes) do nothing;',
    );
    expect(code).toContain(
      "create trigger runner_jobs_resume_limited after update of status on public.runner_jobs for each row when ( new.status = 'failed' and old.status in ('claimed', 'running') "
      + 'and new.limited_until is not null and new.waits < 6 ) execute function public.runner_job_resume_limited();',
    );
  });

  it('says why the seventh limit queues nothing', () => {
    expect(limitBody('runner_job_limit_spent')).toContain(
      "new.reason := 'waited 6 times for a provider limit (last until ' || to_char(new.limited_until at time zone 'UTC', 'HH24:MI') || ' UTC)';",
    );
    expect(code).toContain(
      "create trigger runner_jobs_limit_spent before update of status on public.runner_jobs for each row when ( new.status = 'failed' and old.status in ('claimed', 'running') "
      + 'and new.limited_until is not null and new.waits >= 6 ) execute function public.runner_job_limit_spent();',
    );
  });

  it('runs its functions as their owner, and nobody may call them', () => {
    for (const name of ['runner_job_resume_lost', 'runner_job_resume_limited', 'runner_job_limit_spent']) {
      expect(code).toContain(`function public.${name}() returns trigger language plpgsql security definer set search_path = ''`);
      expect(code).toContain(`revoke execute on function public.${name}() from public, anon, authenticated, service_role;`);
    }
  });

  it('reads the reset the report route stores, and the words an older runner writes for it', () => {
    const service = read('apps/galaxy/src/runners/runners.service.ts');
    const turnover = read('kit/lib/runner/turnover.ts');
    expect(service).toContain('limited_until: limitedUntil(report)');
    expect(service).toContain('no tokens left: every account is out until (');
    expect(turnover).toContain('`no tokens left: every account is out until ${earliest}`');
  });
});

describe('runner_claim()', () => {
  const fn = body('runner_claim');

  it('hands out no job before its resume_after, and every other job as before', () => {
    expect(fn).toContain("and q.status = 'queued' and not q.cancel_requested and (q.resume_after is null or q.resume_after <= now()) and q.repo = any (r.repos)");
    expect(fn).toContain('if r.id is null or not r.github_app or (p_registered_at is not null and r.registered_at <> p_registered_at) then return;');
    expect(fn).toContain('order by q.queued_at, q.id limit 1 for update skip locked');
  });

  it('keeps its signature and stays the service role\'s alone', () => {
    expect(CODE).toContain('create or replace function public.runner_claim(p_runner uuid, p_registered_at timestamptz default null) returns setof public.runner_jobs');
    expect(CODE).toContain('revoke execute on function public.runner_claim(uuid, timestamptz) from public, anon, authenticated;');
    expect(CODE).toContain('grant execute on function public.runner_claim(uuid, timestamptz) to service_role;');
  });
});
