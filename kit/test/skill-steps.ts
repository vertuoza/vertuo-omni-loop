// PRD 1858, s1: what each skill of the plugin does, read from its words — the `omni <verb>` commands it
// names and the guard phrases it states — so a rewording that drops a step fails a test. The
// snapshot beside this file was taken from the skills before any was reworded, and is never edited.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/** One skill's steps: its sorted `omni` verbs and the guard phrases it states. */
export type SkillSteps = Readonly<{ commands: readonly string[]; guards: readonly string[] }>;

/** Every skill's steps, by skill name. */
export type StepsSnapshot = Readonly<Record<string, SkillSteps>>;

/**
 * The guard phrases, matched without regard to case. The first is step 0: `omni session start`
 * reads as `omni kb show briefing`, the one swap allowed (PRD 1858).
 */
const GUARDS: readonly string[] = [
  'omni kb show briefing',
  'omni plan check',
  'omni flow check merge',
  'omni phase0',
  'omni ship',
  'omni status',
  'never merge',
  'draft',
  'labels.outboxGo',
];

/** A skill's words, with every spelling of the command shortened to `omni` and step 0's swap undone. */
function normalize(text: string): string {
  return text
    .replace(/node \S*\.omni-loop\/bin\/omni\.mjs/g, 'omni')
    .replace(/\bomni session start\b/g, 'omni kb show briefing');
}

/** Every Markdown file under `dir`, read and joined. */
function markdownUnder(dir: string): string {
  return readdirSync(dir, { withFileTypes: true })
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((entry) => {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) return markdownUnder(path);
      return entry.name.endsWith('.md') ? readFileSync(path, 'utf8') : '';
    })
    .join('\n');
}

/** The steps of one skill's words. */
export function stepsOf(text: string): SkillSteps {
  const words = normalize(text);
  const commands = new Set([...words.matchAll(/\bomni ([a-z][a-z0-9-]*)/g)].map((match) => match[1] ?? ''));
  const lower = words.toLowerCase();
  const guards = GUARDS.filter((phrase) => lower.includes(phrase.toLowerCase()));
  return { commands: [...commands].sort(), guards };
}

/** The steps of every skill under `skillsDir` (one folder per skill), by skill name. */
export function skillSteps(skillsDir: string): StepsSnapshot {
  const out: Record<string, SkillSteps> = {};
  const skills = readdirSync(skillsDir, { withFileTypes: true }).filter((entry) => entry.isDirectory());
  for (const skill of skills.map((entry) => entry.name).sort()) out[skill] = stepsOf(markdownUnder(join(skillsDir, skill)));
  return out;
}

/** Each step a skill of `snapshot` no longer has in `current`, one line each, naming the skill. */
export function lostSteps(snapshot: StepsSnapshot, current: StepsSnapshot): string[] {
  const lost: string[] = [];
  for (const [skill, was] of Object.entries(snapshot)) {
    const now = current[skill];
    if (!now) {
      lost.push(`${skill}: the skill is gone`);
      continue;
    }
    for (const verb of was.commands) if (!now.commands.includes(verb)) lost.push(`${skill}: lost \`omni ${verb}\``);
    for (const guard of was.guards) if (!now.guards.includes(guard)) lost.push(`${skill}: lost "${guard}"`);
  }
  return lost;
}
