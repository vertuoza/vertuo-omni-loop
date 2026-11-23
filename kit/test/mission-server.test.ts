// A mission lives on the server (PRD 3194, slice s4), read as text as mission-skill-product.test.ts reads its skill:
// `/omni:mission` pushes from a folder outside the repository and makes no branch, worktree, commit or pull request;
// `/omni:mission-retro` commits and pushes nothing at any level; the mission's PM reads the page through
// `omni mission get`; the help entries say the page is the record.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { ENTRIES } from '../lib/help/entries.ts';

const read = (path: string): string => readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8');
const flat = (text: string): string => text.replace(/\s+/g, ' ');

const MISSION = read('../plugin/skills/mission/SKILL.md');
const RETRO = read('../plugin/skills/mission-retro/SKILL.md');
const GUIDE = read('../../docs/guide/missions.md');

/** The `## <heading>` section whose heading starts with `start`, flattened, up to the next one. */
function section(text: string, start: string): string {
  const from = text.indexOf(`\n## ${start}`);
  expect(from, start).toBeGreaterThanOrEqual(0);
  const to = text.indexOf('\n## ', from + 1);
  return flat(text.slice(from, to < 0 ? undefined : to));
}

describe('/omni:mission: the page is the record', () => {
  it('AC-1: holds no worktree, branch, commit or pull-request step', () => {
    const steps = ['Step 0', '1. Settle the brief', '2. Open the issue', '3. Write the brief', '4. Push', '5. Hand off']
      .map((heading) => section(MISSION, heading))
      .join(' ');
    expect(steps).not.toMatch(/git worktree|git push|git commit|gh pr create|docs PR|docs pull request/);
    expect(steps).not.toContain('mission/<nnnn>');
    expect(flat(MISSION)).toContain('cuts no branch, makes no worktree, commits nothing and opens no pull request');
    expect(section(MISSION, '4. Push')).toContain('No branch, commit or pull request is made');
  });

  it('AC-1: pushes the folder outside the repository and hands off the page and Start', () => {
    expect(section(MISSION, '2. Open the issue')).toContain('mktemp -d');
    expect(section(MISSION, '4. Push')).toContain('mission push <n> --from <folder>');
    const handOff = section(MISSION, '5. Hand off');
    expect(handOff).toContain("the mission's page link");
    expect(handOff).toContain('**Start** on that page sends its fleet to work');
    expect(handOff).toContain('what the mission will wait for a person on');
  });

  it('AC-2: a failed push keeps the folder and prints the line to run again', () => {
    const push = section(MISSION, '4. Push');
    expect(push).toContain('the folder is kept');
    expect(push).toContain('`omni mission push <n> --from <folder>` to run again');
    expect(push).toContain('none stands in for a failed push');
    expect(section(MISSION, '5. Hand off')).toContain('`omni mission push <n> --from <folder>` line to run again');
  });
});

describe('/omni:mission-retro: never a commit', () => {
  it('AC-5: commits and pushes nothing at any level, and its record line carries "file": null', () => {
    const keep = section(RETRO, '4. Keep it');
    expect(keep).toContain('Commit nothing and push nothing, at `with-you`, `own-branch` and `alone` alike');
    expect(keep).toContain('"file": null');
    expect(keep).not.toMatch(/git commit|git push|mission branch/);
    const record = section(RETRO, '5. The record line');
    expect(record).toContain('"file":null');
    expect(record).toContain('`file` always `null`');
    expect(record).not.toContain('"file":"<path>"');
  });

  it('reads the mission from its page first and stops on the line when it cannot', () => {
    const step0 = section(RETRO, 'Step 0');
    expect(step0).toContain('omni.mjs mission get <m>');
    expect(step0).toContain('mission <m> not read: <why>');
    expect(step0).toContain('no mission #<m> on the page');
  });
});

describe("a mission's PM reads the page", () => {
  const skills = ['brainstorm', 'roadmap', 'mega-brainstorm', 'mega-roadmap'];
  for (const skill of skills) {
    it(`/omni:${skill} runs omni mission get <m> first and stops on its line`, () => {
      const text = read(`../plugin/skills/${skill}/SKILL.md`);
      const from = text.indexOf("## For a mission's PM");
      expect(from).toBeGreaterThanOrEqual(0);
      const mission = flat(text.slice(from));
      expect(mission).toContain('omni mission get <m>');
      expect(mission).toContain('mission <m> not read: <why>');
      expect(mission).toContain('no mission #<m> on the page');
      expect(mission).not.toContain('under `.omni-loop/delivery/missions/`');
    });
  }
});

describe('the words say the page is the record', () => {
  const entry = (name: string, kind: string) => ENTRIES.find((e) => e.name === name && e.kind === kind);

  it('the help entries of /omni:mission, omni mission and /omni:mission-retro name omni mission get and no docs PR', () => {
    const mission = flat(entry('mission', 'skill')?.detail ?? '');
    expect(mission).toContain('omni mission push --from');
    expect(mission).toContain('omni mission get <n>');
    expect(mission).not.toMatch(/docs PR/);
    const cli = flat(entry('mission', 'command')?.detail ?? '');
    expect(cli).toContain('get <n>');
    const retro = flat(entry('mission-retro', 'skill')?.detail ?? '');
    expect(retro).toContain('commits and pushes nothing');
    expect(retro).toContain('omni mission get <m>');
  });

  it("the guide's missions page names omni mission get and opens no docs pull request for a mission", () => {
    const guide = flat(GUIDE);
    expect(guide).toContain('omni mission get <n>');
    expect(guide).toContain('Its record is its page');
    expect(guide).not.toContain('opens a docs pull request');
    expect(guide).not.toContain('The docs pull request is the record');
  });
});
