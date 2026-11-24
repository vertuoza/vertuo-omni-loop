// AC-9 (PRD 3233 s5): nobody reads "Virtual Fleet" any more. The screens, messages, skills, help and guide
// this slice touches say AI Fleet; past PRDs and migrations are not searched, and identifiers such as
// `virtual-fleets` paths are not words a person reads, so only the space-separated phrase is searched.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const ROOT = fileURLToPath(new URL('../../../../', import.meta.url));

const SCANNED = [
  'apps/galaxy/src/missions',
  'apps/galaxy/src/virtual-fleets/commander',
  'apps/galaxy/src/virtual-fleets/heroes',
  'apps/galaxy/src/virtual-fleets/drawer',
  'apps/omni-app/src/missions',
  'kit/plugin/skills/mission',
  'kit/plugin/skills/committee',
  'kit/lib/help',
  'kit/lib/virtual-fleet',
  'kit/lib/mission',
  'docs/guide',
];

const WORD = /virtual fleet/i;

function filesUnder(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? filesUnder(path) : [path];
  });
}

describe('AC-9: nobody reads Virtual Fleet any more', () => {
  it('finds no "Virtual Fleet" in the screens, messages, skills, help or guide the slice touches', () => {
    const hits = SCANNED.flatMap((dir) => filesUnder(join(ROOT, dir)))
      .filter((file) => WORD.test(readFileSync(file, 'utf8')))
      .map((file) => relative(ROOT, file));
    expect(hits).toEqual([]);
  });
});
