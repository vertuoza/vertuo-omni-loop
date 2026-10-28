// The rewind outcome's migration (PRD 2498 s1), read as text, as main-watch.migration.test.ts reads the
// main watch's: the three nullable columns an approved finding's outcome fills, the one function that
// writes them once, who may call it, the rollback its header names, and the database's types that carry
// them. The rows themselves are proven by supabase/checks/rewind_outcome.sql, which the supabase workflow
// runs as its own step.
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = (path: string) => fileURLToPath(new URL(`../../../../${path}`, import.meta.url));
const read = (path: string) => readFileSync(root(path), 'utf8');
const NAME = '20270104090000_rewind_outcome.sql';
const MIGRATION = read(`supabase/migrations/${NAME}`);
const CODE = MIGRATION.replace(/--.*$/gm, '').replace(/\s+/g, ' ');
const FLAT_TYPES = read('supabase/database.types.ts').replace(/\s+/g, ' ');
const WORKFLOW = read('.github/workflows/supabase.yml');
const CHECK = read('supabase/checks/rewind_outcome.sql');

/** The body of the outcome function, from its `create function` to its closing `$$;`. */
function body(): string {
  const match = /create function public\.rewind_finding_outcome\(.*?\$\$(.*?)\$\$;/.exec(CODE);
  if (!match?.[1]) throw new Error('no function rewind_finding_outcome');
  return match[1];
}

/** The generated Row type of rewind_findings, flattened. */
const findingRow = () => /rewind_findings: \{ Row: \{(.*?)\} Insert:/.exec(FLAT_TYPES)?.[1] ?? '';

describe('the migration', () => {
  // A later PRD's migration may follow it: scripts/migration-order.ts keeps each new one the newest.
  it('is dated after every migration main held when it was written, so supabase db push applies it', () => {
    const versions = readdirSync(root('supabase/migrations')).filter((file) => file.endsWith('.sql')).sort();
    expect(versions.indexOf(NAME)).toBeGreaterThan(versions.indexOf('20261231090000_dossier_light_reads.sql'));
  });

  it('names its rollback in its header: a follow-up migration drops the function and the columns, which nothing else reads', () => {
    expect(MIGRATION).toMatch(/^-- Rollback: a follow-up migration drops rewind_finding_outcome\(\).*outcome.*outcome_pr.*outcome_note.*nothing else reads/ms);
  });

  it('writes no ledger event: an outcome feeds nothing in the game (N-PRODUCT-16)', () => {
    expect(CODE).not.toMatch(/galaxy_events|ledger/);
  });
});

describe('the outcome columns', () => {
  it('add three nullable columns: one of three outcomes, its pull request, its note', () => {
    expect(CODE).toContain("add column outcome text constraint rewind_findings_outcome_check check (outcome in ('proposed', 'already', 'asks'))");
    expect(CODE).toContain('add column outcome_pr integer constraint rewind_findings_outcome_pr_check check (outcome_pr > 0)');
    expect(CODE).toContain('add column outcome_note text constraint rewind_findings_outcome_note_check check (char_length(outcome_note) between 1 and 2000)');
    expect(CODE).not.toMatch(/add column outcome\w* [a-z]+ not null/);
  });

  it('hold an outcome on an approved finding only', () => {
    expect(CODE).toContain("add constraint rewind_findings_outcome_approved check (outcome is null or state = 'approved')");
  });

  it('pair a proposed rule with its pull request, and an already said or a question with its note, never both', () => {
    expect(CODE).toContain(
      "add constraint rewind_findings_outcome_shape check ( (outcome is null and outcome_pr is null and outcome_note is null) or (outcome = 'proposed' and outcome_pr is not null and outcome_note is null) or (outcome in ('already', 'asks') and outcome_pr is null and outcome_note is not null) )",
    );
  });

  it('are granted to nobody to write: no grant names them, so only the function writes them', () => {
    expect(CODE).not.toMatch(/grant [^;]*(insert|update)[^;]* on public\.rewind_findings/);
    expect(CODE).not.toMatch(/create policy/);
  });
});

describe('rewind_finding_outcome()', () => {
  it('runs as a definer, with an empty search path, and answers the finding with its outcome', () => {
    expect(CODE).toContain(
      "create function public.rewind_finding_outcome(p_workspace uuid, p_finding uuid, p_outcome text, p_pr integer default null, p_note text default null) returns public.rewind_findings language plpgsql security definer set search_path = ''",
    );
  });

  it('lets in the service role or a signed-in member of the workspace, anyone else 42501', () => {
    const fn = body();
    expect(fn).toContain("if p_workspace is null or not (auth.role() is not distinct from 'service_role' or ((select auth.uid()) is not null and public.is_member(p_workspace))) then");
    expect(fn).toContain("raise exception 'Only the Omni App or a member of the workspace records a rewind finding''s outcome.' using errcode = '42501';");
  });

  it('refuses an outcome it does not know, and a missing or misplaced value, 22023 naming the field', () => {
    const fn = body();
    expect(fn).toContain("if p_outcome is null or p_outcome not in ('proposed', 'already', 'asks') then raise exception 'Outcome: proposed, already or asks.' using errcode = '22023', hint = 'outcome';");
    expect(fn).toContain("if p_pr is null or p_pr <= 0 then raise exception 'Pull request: a proposed rule names the pull request that proposes it.' using errcode = '22023', hint = 'pr';");
    expect(fn).toContain("raise exception 'Note: a proposed rule takes its pull request, and no note.' using errcode = '22023', hint = 'note';");
    expect(fn).toContain("raise exception 'Pull request: only a proposed rule names one.' using errcode = '22023', hint = 'pr';");
    expect(fn).toContain("raise exception 'Note: % names the rule that already says it, or the question asked.', p_outcome using errcode = '22023', hint = 'note';");
    expect(fn).toContain("if p_outcome = 'already' and (char_length(note) > 200 or note ~ '[\\n\\r]') then raise exception 'Note: the rule that already says it, one line of at most 200 characters.' using errcode = '22023', hint = 'note';");
    expect(fn).toContain("if char_length(note) > 2000 then raise exception 'Note: the question, 2000 characters at most.' using errcode = '22023', hint = 'note';");
  });

  it('finds the finding in the workspace, locked: P0002 for none', () => {
    const fn = body();
    expect(fn).toContain('where f.id = p_finding and f.workspace_id = p_workspace for update;');
    expect(fn).toContain("raise exception 'Finding: no such finding in this workspace.' using errcode = 'P0002', hint = 'finding';");
  });

  it('records an outcome on an approved finding only, once: anything else 42501, and an outcome is never rewritten (BR-PRODUCT-12)', () => {
    const fn = body();
    expect(fn).toContain("if found_one.state <> 'approved' then raise exception 'Finding: %, and only an approved finding has an outcome.', found_one.state using errcode = '42501', hint = 'finding';");
    expect(fn).toContain("if found_one.outcome is not null then raise exception 'Outcome: already %, and an outcome is never rewritten.', found_one.outcome using errcode = '42501', hint = 'outcome';");
    expect(fn).toContain('set outcome = p_outcome, outcome_pr = p_pr, outcome_note = note where f.id = found_one.id');
  });

  it('is run by the service role or a signed-in person, never anyone signed out', () => {
    expect(CODE).toContain('revoke execute on function public.rewind_finding_outcome(uuid, uuid, text, integer, text) from public, anon;');
    expect(CODE).toContain('grant execute on function public.rewind_finding_outcome(uuid, uuid, text, integer, text) to authenticated, service_role;');
  });
});

describe('the database\'s types', () => {
  it('carry the three columns on the finding', () => {
    expect(findingRow()).toContain('outcome: string | null outcome_note: string | null outcome_pr: number | null');
  });

  it('name the function, its pull request and note optional', () => {
    expect(FLAT_TYPES).toContain('rewind_finding_outcome: { Args: { p_finding: string p_note?: string p_outcome: string p_pr?: number p_workspace: string }');
  });
});

describe('the check', () => {
  it('is its own step of the supabase workflow', () => {
    expect(WORKFLOW).toContain("run: psql 'postgresql://postgres:postgres@127.0.0.1:54322/postgres' -v ON_ERROR_STOP=1 -f supabase/checks/rewind_outcome.sql");
  });

  it('proves each outcome, the refusals, and that nobody writes the columns but through the function', () => {
    for (const proof of [
      "'FAIL: a member did not read the outcome'",
      "'FAIL: a second outcome was recorded'",
      "'FAIL: an outcome was recorded on a finding not approved'",
      "'FAIL: a member of another workspace recorded an outcome'",
      "'FAIL: the service role wrote the outcome without its function'",
      "'FAIL: a member wrote the outcome without its function'",
    ]) expect(CHECK).toContain(proof);
  });
});
