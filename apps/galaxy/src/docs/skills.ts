import { ENTRIES, SKILL_GROUPS } from 'vertuo-omni-plan/kit/lib/help/entries.ts';
import { DOCS_PATH } from './paths';
import { group } from 'vertuo-omni-plan/kit/lib/narrow.ts';

// The skills pages of the docs (PRD 580): /docs/skills, every skill grouped by what you want to do,
// and /docs/skills/<name>, one page per skill. Pure: built from the skill entries of the help table
// (kit/lib/help/entries.ts), the one source `omni help` prints too, so nothing is written twice.
// Words in braces are filled with generic ones, never a repository's: the docs are the same for every
// reader. Who runs a skill and its related skills are derived from the /omni:<name> its words name.

/** Where the skills pages are served. */
export const SKILLS_PATH = `${DOCS_PATH}/skills`;

/** Where a skill's full instructions, its SKILL.md, are read on GitHub. */
const SKILL_SOURCE = 'https://github.com/vertuoza/vertuo-omni-loop/blob/main/kit/plugin/skills';

/** A skill entry of the help table, the fields the pages read. */
export interface SkillEntry {
  name: string;
  kind: 'skill' | 'command';
  who: 'you' | 'skills';
  usage: readonly string[];
  summary: string;
  detail: string;
  group?: string;
  when?: string;
  example?: { type: string; result: string };
}

/** A group of SKILL_GROUPS. */
export interface SkillGroupEntry {
  id: string;
  title: string;
}

/** A skill as a link: its name, its slash command and its page. */
export interface SkillLink {
  name: string;
  command: string;
  url: string;
}

/** A card of the overview. */
export interface SkillCard extends SkillLink {
  summary: string;
}

/** A section of the overview. */
export interface SkillSection {
  id: string;
  title: string;
  skills: SkillCard[];
}

/** One skill's page. */
export interface SkillPageModel extends SkillCard {
  what: string;
  when: string;
  usage: string[];
  example: { type: string; result: string };
  /** `you` for a skill you type, else the skills that run it. */
  runBy: 'you' | SkillLink[];
  /** The other skills its words name, in the order they are named. */
  related: SkillLink[];
  /** Its SKILL.md on GitHub. */
  source: string;
}

const HELP_ENTRIES: readonly SkillEntry[] = ENTRIES;
const GROUPS: readonly SkillGroupEntry[] = SKILL_GROUPS;

/** The generic words that stand for a repository's own in the help table's braces. */
const DELIVERY = '.omni-loop/delivery';
const GENERIC_WORDS: Readonly<Record<string, string>> = {
  defaultBranch: 'the default branch',
  remote: 'the remote',
  delivery: DELIVERY,
  inbox: `${DELIVERY}/inbox/`,
  shipped: `${DELIVERY}/shipped/`,
};

/** `text` with every known word in braces filled with its generic word; an unknown one is kept. */
export function fillGeneric(text: string): string {
  return text.replace(/\{(\w+)\}/g, (whole, key: string) => (Object.hasOwn(GENERIC_WORDS, key) ? (GENERIC_WORDS[key] ?? whole) : whole));
}

const skillsOf = (entries: readonly SkillEntry[]) => entries.filter((entry) => entry.kind === 'skill');

const linkTo = (name: string): SkillLink => ({ name, command: `/omni:${name}`, url: `${SKILLS_PATH}/${name}` });

/** The skill names `texts` name as /omni:<name>, in order, once each. */
const named = (texts: readonly string[]) => [...new Set(texts.flatMap((text) => [...text.matchAll(/\/omni:([a-z](?:[a-z0-9-]*[a-z0-9])?)/g)].map((m) => group(m, 1))))];

/** The overview: one section per group in SKILL_GROUPS order, its skills in the entries' order; a
 * group with no skill is left out. */
export function skillsOverview(entries: readonly SkillEntry[] = HELP_ENTRIES, groups: readonly SkillGroupEntry[] = GROUPS): SkillSection[] {
  const skills = skillsOf(entries);
  return groups
    .map((group) => ({
      id: group.id,
      title: group.title,
      skills: skills.filter((entry) => entry.group === group.id)
        .map((entry) => ({ ...linkTo(entry.name), summary: fillGeneric(entry.summary) })),
    }))
    .filter((group) => group.skills.length > 0);
}

/** Every skill's name, in the overview's order. */
export function skillNames(entries: readonly SkillEntry[] = HELP_ENTRIES): string[] {
  return skillsOverview(entries).flatMap((group) => group.skills.map((skill) => skill.name));
}

/** A skill's page, or undefined when no skill has that name. */
export function skillPage(name: string, entries: readonly SkillEntry[] = HELP_ENTRIES): SkillPageModel | undefined {
  const skills = skillsOf(entries);
  const entry = skills.find((candidate) => candidate.name === name);
  if (!entry) return undefined;
  const known = new Set(skills.map((skill) => skill.name));
  const others = (names: readonly string[]) => names.filter((other) => other !== name && known.has(other)).map(linkTo);
  const example = entry.example ?? { type: '', result: '' };
  const own = [entry.detail, entry.when ?? ''];
  // A skill run by the skills names its runners in its own words ("/omni:brainstorm runs it"); a
  // runner may name it in its words too.
  const runners = [...named(own), ...skills.filter((other) => named([other.detail, other.when ?? '']).includes(name)).map((other) => other.name)];
  return {
    ...linkTo(entry.name),
    summary: fillGeneric(entry.summary),
    what: fillGeneric(entry.detail),
    when: fillGeneric(entry.when ?? ''),
    usage: entry.usage.map(fillGeneric),
    example: { type: fillGeneric(example.type), result: fillGeneric(example.result) },
    runBy: entry.who === 'you' ? 'you' : others([...new Set(runners)]),
    related: others(named([...own, example.type, example.result])),
    source: `${SKILL_SOURCE}/${entry.name}/SKILL.md`,
  };
}
