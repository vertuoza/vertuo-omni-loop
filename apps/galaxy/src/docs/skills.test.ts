import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { ENTRIES, SKILL_GROUPS } from 'vertuo-omni-plan/kit/lib/help/entries.ts';
import { fillGeneric, skillNames, skillPage, skillsOverview, type SkillEntry } from './skills';
import { sure } from '../arcade/test/sure';

// The skills pages' model (PRD 580): built from the help table's skill entries, the one source, so a
// skill with an entry has its page and nothing else is written by hand.

const SKILLS_DIR = fileURLToPath(new URL('../../../../kit/plugin/skills', import.meta.url));
const folders = readdirSync(SKILLS_DIR, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name).sort();

/** A skill entry for a fixture, the fields the model reads. */
const skill = (name: string, group: string, words = ''): SkillEntry => ({
  name, kind: 'skill', who: 'you', usage: [`/omni:${name}`], summary: `the ${name} summary`,
  detail: `Does ${name}. ${words}`.trim(), group, when: 'Use it when you want it.',
  example: { type: `/omni:${name}`, result: 'something' },
});

describe('the overview', () => {
  it('holds the groups in SKILL_GROUPS order, each with its skills in the entries\' order', () => {
    const groups = skillsOverview();
    expect(groups.map((g) => g.title)).toEqual([
      'Start a change', 'Build it', 'Set up a repository', 'Several repositories', 'Every day', 'Run by other skills',
    ]);
    expect(groups.find((g) => g.id === 'start')?.skills.map((s) => s.name)).toEqual(['think-big', 'brainstorm', 'roadmap', 'visual-fix', 'bug-fix']);
    expect(groups.find((g) => g.id === 'build')?.skills.map((s) => s.name)).toEqual(['yolo', 'yolo-fix', 'plan', 'wave', 'do-work', 'pr', 'pr-care', 'drive']);
    expect(groups.find((g) => g.id === 'multi-repo')?.skills.map((s) => s.name)).toContain('mega-drive'); // PRD 1162
    expect(groups.find((g) => g.id === 'multi-repo')?.skills.map((s) => s.name).join(' ')).toContain('mega-brainstorm mega-roadmap'); // PRD 1162 s9
    expect(sure(groups[1], 'groups[1]').skills[0]).toEqual({
      name: 'yolo', command: '/omni:yolo', summary: 'build a whole PRD: plan, waves, the outbox gate, ship', url: '/docs/skills/yolo',
    });
  });

  it('lists every skill folder once, and no command', () => {
    const listed = skillsOverview().flatMap((g) => g.skills.map((s) => s.name));
    expect([...listed].sort()).toEqual(folders);
    expect(new Set(listed).size).toBe(listed.length);
    expect(skillNames()).toEqual(listed);
  });

  it('leaves out a group with no skill', () => {
    const groups = skillsOverview([skill('a', 'build'), skill('b', 'start')], SKILL_GROUPS);
    expect(groups.map((g) => g.id)).toEqual(['start', 'build']);
  });
});

describe('a skill page', () => {
  it('exists for every skill folder, and for no other name', () => {
    for (const name of folders) expect(skillPage(name)?.command, name).toBe(`/omni:${name}`);
    expect(skillPage('nope')).toBeUndefined();
    expect(skillPage('board')).toBeUndefined(); // a command, not a skill
  });

  it('carries what it does, when to use it, its usage, its example and its SKILL.md', () => {
    const page = sure(skillPage('wave'), 'skillPage(\'wave\')');
    const entry = sure((ENTRIES as readonly SkillEntry[]).find((e) => e.kind === 'skill' && e.name === 'wave'), 'the wave skill\'s entry');
    expect(page.summary).toBe(entry.summary);
    expect(page.when).toBe(entry.when);
    expect(page.usage).toEqual(['/omni:wave <n>']);
    expect(page.example).toEqual(entry.example);
    expect(page.source).toBe('https://github.com/vertuoza/vertuo-omni-loop/blob/main/kit/plugin/skills/wave/SKILL.md');
  });

  it('fills the words in braces with generic ones, on every page', () => {
    expect(fillGeneric('{defaultBranch} of {remote}, {delivery} {inbox} {shipped} {other}'))
      .toBe('the default branch of the remote, .omni-loop/delivery .omni-loop/delivery/inbox/ .omni-loop/delivery/shipped/ {other}');
    expect(sure(skillPage('yolo'), 'skillPage(\'yolo\')').what).toContain('It never merges into the default branch.');
    for (const name of skillNames()) expect(JSON.stringify(skillPage(name)), name).not.toMatch(/\{\w+\}/);
  });

  it('says you run a skill you type, and names the skills that run one they run', () => {
    expect(sure(skillPage('yolo'), 'skillPage(\'yolo\')').runBy).toBe('you');
    expect(sure(skillPage('dossier-push'), 'skillPage(\'dossier-push\')').runBy).toEqual([
      { name: 'brainstorm', command: '/omni:brainstorm', url: '/docs/skills/brainstorm' },
      { name: 'plan', command: '/omni:plan', url: '/docs/skills/plan' },
      { name: 'visual-fix', command: '/omni:visual-fix', url: '/docs/skills/visual-fix' },
      { name: 'bug-fix', command: '/omni:bug-fix', url: '/docs/skills/bug-fix' },
    ]);
    expect(sure(skillPage('dossier-open'), 'skillPage(\'dossier-open\')').runBy).toEqual([
      { name: 'brainstorm', command: '/omni:brainstorm', url: '/docs/skills/brainstorm' },
      { name: 'think-big', command: '/omni:think-big', url: '/docs/skills/think-big' },
    ]);
  });

  it('names a run-by-skills skill\'s runner when that skill\'s words name it', () => {
    const entries = [skill('runner', 'build', 'It runs /omni:helper first.'), { ...skill('helper', 'run-by-skills'), who: 'skills' as const }];
    expect(sure(skillPage('helper', entries), 'skillPage(\'helper\', entries)').runBy).toEqual([{ name: 'runner', command: '/omni:runner', url: '/docs/skills/runner' }]);
  });

  it('relates the other skills its words name, in naming order, once each, never itself nor a skill with no entry', () => {
    expect(sure(skillPage('yolo'), 'skillPage(\'yolo\')').related.map((s) => s.name)).toEqual(['wave']);
    expect(sure(skillPage('mega-brainstorm'), 'skillPage(\'mega-brainstorm\')').related.map((s) => s.name)).toEqual(['mega-invade', 'ultra-yolo']);
    expect(sure(skillPage('think-big'), 'skillPage(\'think-big\')').related.map((s) => s.name)).toEqual(['brainstorm', 'visual-fix']);
    expect(sure(skillPage('help'), 'skillPage(\'help\')').related.map((s) => s.name)).toEqual(['yolo']);
    expect(sure(skillPage('pr'), 'skillPage(\'pr\')').related).toEqual([]);
    const entries = [skill('a', 'build', 'Then /omni:c, /omni:b, /omni:a, /omni:c and /omni:gone.'), skill('b', 'build'), skill('c', 'build')];
    expect(sure(skillPage('a', entries), 'skillPage(\'a\', entries)').related.map((s) => s.name)).toEqual(['c', 'b']);
  });
});
