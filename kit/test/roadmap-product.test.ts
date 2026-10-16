// PRD 2011, slice s4: `/omni:roadmap --product <key>` and `/omni:mega-roadmap --product <key>` write a
// product roadmap with no issue and no phase-0 PR, and `/omni:drive --roadmap mobile-R3` (and
// `/omni:mega-drive`) reads its rows from the server. Each point of the slice's "done when" is read here
// against the skills' SKILL.md text, and the commands they name are checked against the CLI's own usage.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const skill = (name: string) => readFileSync(new URL(`../plugin/skills/${name}/SKILL.md`, import.meta.url), 'utf8');
const roadmapCli = readFileSync(new URL('../bin/commands/roadmap.ts', import.meta.url), 'utf8');

/** A text with each run of whitespace made one space: prose wraps its lines anywhere. */
const flat = (text: string) => text.replace(/\s+/g, ' ');

/** The section whose `## ` heading starts with `start`, up to the next `## ` heading outside a fence. */
function section(text: string, start: string) {
  const lines = text.split('\n');
  let fenced = false;
  let from = -1;
  for (const [index, line] of lines.entries()) {
    if (line.trim().startsWith('```')) fenced = !fenced;
    else if (!fenced && line.startsWith('## ')) {
      if (from >= 0) return lines.slice(from, index).join('\n');
      if (line.startsWith(`## ${start}`)) from = index;
    }
  }
  return from < 0 ? '' : lines.slice(from).join('\n');
}

describe('/omni:roadmap --product', () => {
  const text = section(skill('roadmap'), 'From a product');

  it('has a From a product section', () => {
    expect(text).not.toBe('');
  });

  it('creates the roadmap with the commands the CLI offers, and prints its id first', () => {
    expect(text).toContain('roadmap check --product <key>');
    expect(text).toContain('roadmap push --product <key> --new');
    expect(roadmapCli).toContain('omni roadmap check --product <key> <file>');
    expect(roadmapCli).toContain('omni roadmap push --product <key> (--new | --roadmap <n>) <file>');
    expect(flat(text)).toContain('Its first line is the new roadmap\'s id, `<key>-R<n>`');
  });

  it('opens no roadmap issue, no PRD issue and no phase-0 PR', () => {
    expect(flat(text)).toContain('no roadmap issue, no PRD issue, no branch, no commit, no phase-0 PR');
    expect(text).not.toContain('gh issue create');
    expect(text).not.toContain('gh pr create');
  });

  it('puts every PRD on the server, in wave order, and approves nothing', () => {
    expect(text).toContain('dossier push --product <key> --new --from');
    expect(flat(text)).toContain('this skill never approves it');
  });

  it('ends with the drive line of the product roadmap', () => {
    expect(text).toContain('/omni:drive --roadmap <key>-R<n>');
  });

  it('is not turned away by a plan section when the run is a product\'s', () => {
    expect(flat(skill('roadmap'))).toContain('unless this is a product run');
  });
});

describe('/omni:mega-roadmap --product', () => {
  const text = section(skill('mega-roadmap'), 'From a product');

  it('writes a product roadmap to the server with no issue and no phase-0 PR', () => {
    expect(flat(text)).toContain('with no roadmap issue, no PRD issue, no branch, no commit and no phase-0 PR');
    expect(text).toContain('roadmap push --product <key> --new');
    expect(text).toContain('roadmap check --product <key>');
  });

  it('refuses a repository whose phase 0 is a pull request, as mega-brainstorm does', () => {
    expect(text).toContain('omni.mjs product phase0 <owner/name>');
  });

  it('is not turned away by a missing plan section when the run is a product\'s', () => {
    expect(flat(skill('mega-roadmap'))).toContain('unless this is a product run');
  });
});

describe('/omni:drive and /omni:mega-drive --roadmap <key>-R<n>', () => {
  for (const name of ['drive', 'mega-drive']) {
    const whole = skill(name);
    const text = section(whole, 'From a product roadmap');

    it(`${name}: takes a product roadmap's id and reads its rows from the server`, () => {
      expect(whole).toContain('--roadmap <key>-R<n>');
      expect(whole).toContain('--roadmap mobile-R3');
      expect(text).toContain('dossier get <key>-R<n> roadmap');
    });

    it(`${name}: records no tick and pushes no repository roadmap for it`, () => {
      expect(flat(text)).toMatch(/records no tick/);
      expect(flat(text)).toContain('omni roadmap push <n>');
    });

    it(`${name}: is not stopped by the plan-repository check`, () => {
      expect(flat(whole)).toContain('product roadmap');
    });
  }

  it('drive holds a blocked row until its blockers merged, naming the pull request', () => {
    expect(flat(section(skill('drive'), 'From a product roadmap'))).toContain('waits on <repo>#<pr>');
  });
});
