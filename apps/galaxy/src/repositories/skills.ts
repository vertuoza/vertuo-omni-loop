import type { RepoReader } from '../business/draft/github';
import { RUNNER_SKILLS } from '../runners/runners.contract';

// A repository's own skills, read live (PRD 2313 s3): `.claude/skills/<name>/SKILL.md` on its default
// branch, through the Omni App's installation, never stored. A skill is listed with its frontmatter's
// `name` and `description`; a folder with no SKILL.md, a name that is not `[a-z][a-z0-9-]*` or is not its
// folder's (the runner looks for the skill by that folder), and a name on the runners' fixed list (which
// is never allowed, so `/yolo` never means `/omni:yolo`) are left out. A failed read answers its reason.

const SKILLS_DIR = '.claude/skills';
const NAME = /^[a-z][a-z0-9-]*$/;
const FIXED: readonly string[] = RUNNER_SKILLS;

/** What the reader asks GitHub: the live reader (`repoReader`) answers all three. */
export type SkillsSource = Pick<RepoReader, 'file'> & {
  folders(installation: number, repository: string, path: string): Promise<string[]>;
  defaultBranch(installation: number, repository: string): Promise<string | null>;
};

export interface FoundSkill {
  name: string;
  description: string | null;
}

export type SkillsListing =
  | { ok: true; skills: FoundSkill[]; branch: string | null }
  | { ok: false; reason: string };

const unquoted = (value: string) => (/^(["']).*\1$/.test(value) ? value.slice(1, -1) : value);

/** The frontmatter's top-level `key: value` lines, a `>` or `|` block folded into one line. */
export function frontmatterOf(text: string): Record<string, string> {
  const head = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text);
  if (!head?.[1]) return {};
  const found: Record<string, string> = {};
  let block: string | null = null;
  for (const line of head[1].split(/\r?\n/)) {
    const key = /^([\w-]+):\s*(.*)$/.exec(line);
    if (key?.[1] !== undefined) {
      const value = (key[2] ?? '').trim();
      if (/^[>|][+-]?$/.test(value)) {
        block = key[1];
        found[block] = '';
      } else {
        block = null;
        found[key[1]] = unquoted(value);
      }
    } else if (block !== null && line.trim()) {
      found[block] = `${found[block] ?? ''} ${line.trim()}`.trim();
    }
  }
  return found;
}

const why = (error: unknown) => (error instanceof Error ? error.message : String(error));

export function skillsReader(source: SkillsSource) {
  return {
    async read(installation: number, repository: string): Promise<SkillsListing> {
      try {
        const folders = await source.folders(installation, repository, SKILLS_DIR);
        const found = await Promise.all(folders.map(async (folder): Promise<FoundSkill | null> => {
          const text = await source.file(installation, repository, `${SKILLS_DIR}/${folder}/SKILL.md`);
          if (text === null) return null;
          const { name = folder, description } = frontmatterOf(text);
          if (!NAME.test(name) || name !== folder || FIXED.includes(name)) return null;
          return { name, description: description?.trim() || null };
        }));
        const skills = found.filter((s): s is FoundSkill => s !== null).sort((a, b) => a.name.localeCompare(b.name, 'en'));
        const branch = await source.defaultBranch(installation, repository).catch(() => null);
        return { ok: true, skills, branch };
      } catch (error) {
        return { ok: false, reason: why(error) };
      }
    },
  };
}
