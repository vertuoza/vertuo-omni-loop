// The database's list of the runners' fixed skills (PRD 2873 s1), read as text, as runners.skills.migration.test.ts reads the
// migration that made it: set_repository_runner_skill() refuses a repository's own skill named like one of the loop's own, and
// the list it refuses is the one the newest migration that defines the function holds. That list equals RUNNER_SKILLS, the app's,
// which runners.contract.test.ts holds equal to the kit's: a skill added to the app's list and not to the database's fails here.
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { FLEET_RUNNER_SKILLS, RUNNER_SKILLS } from './runners.contract';

const MIGRATIONS = fileURLToPath(new URL('../../../../supabase/migrations/', import.meta.url));
const code = (file: string) => readFileSync(`${MIGRATIONS}${file}`, 'utf8').replace(/--.*$/gm, '').replace(/\s+/g, ' ');
const DEFINES = /create (?:or replace )?function public\.set_repository_runner_skill\(/;

/** The migrations that define set_repository_runner_skill(), oldest first: the last is the one the database runs. */
const defining = readdirSync(MIGRATIONS).filter((file) => file.endsWith('.sql')).sort().filter((file) => DEFINES.test(code(file)));
const NEWEST = defining.at(-1) ?? '';
const ORIGINAL = '20261222090000_repository_runner_skills.sql';

/** The body of set_repository_runner_skill() in a migration, from its `create` to its closing `$$;`. */
function body(file: string): string {
  const match = /create (?:or replace )?function public\.set_repository_runner_skill\((.*?)\$\$;/.exec(code(file));
  if (!match?.[1]) throw new Error(`no set_repository_runner_skill() in ${file}`);
  return match[1];
}

/** The fixed list a body holds, name by name. */
const fixedOf = (fn: string): string[] =>
  (/fixed text\[\] := array\[([^\]]*)\]/.exec(fn)?.[1] ?? '').split(',').map((name) => name.trim().replace(/^'|'$/g, '')).filter((name) => name !== '');

describe('the runners\' fixed skills, as the database holds them', () => {
  it('are defined by the runner ultra skills migration, then by the Reviewer\'s (PRD 2871), which adds review, then by the committee\'s (PRD 2896), which adds committee, then by the PM\'s (PRD 2896 s12), which adds its four, then by a mission\'s repairs\' (PRD 2980), which adds repair, then by QA\'s turn\'s (PRD 3001), which adds qa, then by a mission\'s retros\' (PRD 3065), which adds mission-retro, then by a goal-only mission\'s New mission box (PRD omni-loop-24), which adds mission, then last by the Architect\'s review (PRD omni-loop-26), which adds tech-review', () => {
    expect(defining).toContain('20270122120000_runner_ultra_skills.sql');
    expect(defining).toContain('20270122122000_reviewer.sql');
    expect(NEWEST).toBe('20270129150000_runner_skill_tech_review.sql');
    expect(fixedOf(body('20270122122000_reviewer.sql'))).toEqual([...fixedOf(body('20270122120000_runner_ultra_skills.sql')), 'review']);
    expect(fixedOf(body('20270124130000_mission_committee.sql'))).toEqual([...fixedOf(body('20270122122000_reviewer.sql')), 'committee']);
    expect(fixedOf(body('20270124150000_mission_pm.sql'))).toEqual([...fixedOf(body('20270124130000_mission_committee.sql')), 'brainstorm', 'roadmap', 'mega-brainstorm', 'mega-roadmap']);
    expect(fixedOf(body('20270125140000_mission_repairs.sql'))).toEqual([...fixedOf(body('20270124150000_mission_pm.sql')), 'repair']);
    expect(fixedOf(body('20270125160000_qa_turn.sql'))).toEqual([...fixedOf(body('20270125140000_mission_repairs.sql')), 'qa']);
    expect(fixedOf(body('20270126120000_mission_retro_skill.sql'))).toEqual([...fixedOf(body('20270125160000_qa_turn.sql')), 'mission-retro']);
    expect(fixedOf(body('20270129120000_mission_skill.sql'))).toEqual([...fixedOf(body('20270126120000_mission_retro_skill.sql')), 'mission']);
    expect(fixedOf(body(NEWEST))).toEqual([...fixedOf(body('20270129120000_mission_skill.sql')), 'tech-review']);
  });

  it('equal the app\'s list and its fleet\'s skills, the four the database lacked and the three ultra skills among them', () => {
    const fixed = fixedOf(body(NEWEST));
    expect(fixed).toEqual([...RUNNER_SKILLS, ...FLEET_RUNNER_SKILLS]);
    for (const skill of ['retro-apply', 'rewind', 'knowledge-add', 'rewind-apply', 'ultra-yolo', 'ultra-wave', 'ultra-yolo-fix', 'review', 'committee', 'brainstorm', 'roadmap', 'mega-brainstorm', 'mega-roadmap']) expect(fixed, skill).toContain(skill);
  });

  it('change nothing else of the function: the same signature, rules and words as the migration that made it', () => {
    const list = /fixed text\[\] := array\[[^\]]*\]/;
    expect(body(NEWEST).replace(list, 'LIST')).toBe(body(ORIGINAL).replace(list, 'LIST'));
    expect(code(NEWEST)).toContain('create or replace function public.set_repository_runner_skill(p_workspace uuid, p_full_name text, p_skill text, p_allowed boolean) returns void language plpgsql security definer set search_path = \'\'');
  });

  it('keep the function run by a signed-in person only', () => {
    expect(code(NEWEST)).toContain('revoke execute on function public.set_repository_runner_skill(uuid, text, text, boolean) from public, anon;');
    expect(code(NEWEST)).toContain('grant execute on function public.set_repository_runner_skill(uuid, text, text, boolean) to authenticated;');
  });
});
