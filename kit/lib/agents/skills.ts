/**
 * **The kit's skills, wherever `omni` runs** (PRD 1890, slice s2). Every file under
 * `kit/plugin/skills/`, as `{ <posix path under that folder>: text }`: `do-work/SKILL.md`,
 * `pixel-perfect/reference/review.md`.
 *
 * The skills travel inside the bundle, so a repository's `omni` writes the skills of its own version,
 * offline: `kit/build.ts` reads the folder with {@link readSkills} and defines `__OMNI_SKILLS__` as
 * its JSON. From source, the same folder is read now. Either way a file's text is the file's, byte for
 * byte (`kit/test/dist.test.ts`).
 */
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { readTemplates } from '../playbook/templates.ts';

/** Defined by `kit/build.ts` in the bundle only: the skills as JSON text. */
declare const __OMNI_SKILLS__: string | undefined;

/** The bundle's skills: `{ <path under the skills folder>: text }`. */
const BundledSkillsSchema = z.record(z.string(), z.string());

const BUNDLED = typeof __OMNI_SKILLS__ === 'undefined' ? null : BundledSkillsSchema.parse(JSON.parse(__OMNI_SKILLS__));

/** Where the kit's skills live in the kit, as the generated line of a copy names it. */
export const SKILLS_SOURCE = 'kit/plugin/skills';

/** The kit's skills folder, when running from source. */
function skillsDir(): string {
  return fileURLToPath(new URL('../../plugin/skills/', import.meta.url));
}

/** Every file under `dir` (the kit's skills folder by default), in code-point order of the names. */
export function readSkills(dir: string = skillsDir()): Record<string, string> {
  return readTemplates(dir);
}

/** The kit's skills: the bundle's copy, else the folder read now. */
export function kitSkills(): Record<string, string> {
  return BUNDLED ? { ...BUNDLED } : readSkills();
}
