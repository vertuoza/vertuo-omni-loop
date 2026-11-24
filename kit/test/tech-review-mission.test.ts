// PRD omni-loop-26, slice s3: `/omni:tech-review <key>-<n> --mission <m>`, the line a mission's Architect is sent
// on a runner, runs unattended: it reads before it decides, asks nobody, changes only the plan's coding parts
// as a new plan version on the PRD's page, writes nothing in the repository, gives no approval, and ends on the
// `omni tech:` record line the App reads (kit/lib/virtual-fleet/tech-record.ts). Read as text from SKILL.md.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { techLine } from '../lib/virtual-fleet/tech-record.ts';
import { COMMAND_TABLE } from '../bin/commands/index.ts';

const TEXT = readFileSync(new URL('../plugin/skills/tech-review/SKILL.md', import.meta.url), 'utf8');

/** The section whose `## ` heading starts with `start`, up to the next `## ` heading outside a fence. */
function section(text: string, start: string): string {
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

const flat = (text: string): string => text.replace(/\s+/g, ' ');

/** The first of `phrases` missing from `text` in that order, or null when all appear in order. */
function inOrder(text: string, phrases: readonly string[]): string | null {
  let at = 0;
  for (const phrase of phrases) {
    const found = text.indexOf(phrase, at);
    if (found < 0) return phrase;
    at = found + phrase.length;
  }
  return null;
}

const MISSION = section(TEXT, "For a mission's Architect");
const FLAT = flat(MISSION);
const SHA = 'a'.repeat(64);

describe("/omni:tech-review <key>-<n> --mission <m>, the mission's Architect (PRD omni-loop-26)", () => {
  it('takes the runner line and says so in its description and its input', () => {
    const description = /^description: (.*)$/m.exec(TEXT)?.[1] ?? '';
    expect(description).toContain('<key>-<n> --mission <m>');
    expect(flat(section(TEXT, 'Input'))).toContain('`<key>-<n> --mission <m>`');
    expect(MISSION).not.toBe('');
  });

  it('refuses a run under OMNI_UNATTENDED only without --mission, and --mission off a runner or on a PRD number', () => {
    const refusals = flat(section(TEXT, '1. Refuse'));
    expect(refusals).toContain('`OMNI_UNATTENDED` is set and the line carries no `--mission`');
    expect(refusals).toContain('`--mission` without `OMNI_UNATTENDED`');
    expect(refusals).toContain('`--mission` with a PRD that is not a product PRD');
  });

  it('asks nothing: no question tool, every point settled from the files or left open', () => {
    expect(FLAT).toContain('Asks nobody');
    expect(FLAT).toContain('`OMNI_UNATTENDED`');
    expect(FLAT).toContain('most reversible');
    expect(MISSION).not.toContain('AskUserQuestion');
    expect(FLAT).toContain('a line of `open`');
    expect(FLAT).toContain('a line of `settled`');
  });

  it('reads the spec, the plan, the Technical tab, the four forms, the laws and the code before it decides', () => {
    expect(
      inOrder(FLAT, [
        'node .omni-loop/bin/omni.mjs prd <key>-<n>',
        'dossier get <key>-<n> spec',
        'dossier get <key>-<n> plan',
        'dossier get <key>-<n> before-after',
        '**Technical** tab',
        'kb laws --paths',
      ]),
    ).toBeNull();
    for (const form of ['architecture', 'testing', 'conventions', 'ci']) expect(FLAT, form).toContain(`kb show ${form}`);
    expect(FLAT).toContain('has no plan on its page');
  });

  it("changes only the plan's coding parts, pushed as a new plan version, and writes nothing in the repository", () => {
    expect(FLAT).toContain("only the plan's coding parts");
    expect(FLAT).toContain('dossier push <key>-<n> --from <prd folder>');
    expect(FLAT).toContain('a new plan version');
    expect(FLAT).toContain('never changes the spec, the before/after page or the voice');
    for (const none of ['no commit', 'no branch', 'no pull request', 'no issue comment']) expect(FLAT, none).toContain(none);
    for (const verb of [/git (?:commit|push|worktree)/, /gh (?:issue|pr) (?:comment|create)/, /\/omni:dossier-push/]) expect(MISSION).not.toMatch(verb);
  });

  it('names the reviewed version by the sha256 dossier get prints after the push', () => {
    expect(inOrder(FLAT, ['dossier push <key>-<n> --from <prd folder>', 'dossier get <key>-<n> plan', 'sha256'])).toBeNull();
  });

  it('ends on the omni tech: record line, in the shape the App reads, approved only with no open point', () => {
    const record = MISSION.split('\n')
      .map((line) => line.trim())
      .find((line) => line.startsWith('omni tech: '));
    expect(record).toBe('omni tech: {"v":1,"prd":"<key>-<n>","plan":"<sha256>","settled":["…"],"open":["…"],"outcome":"approved|escalated"}');
    expect(FLAT).toContain("the run's last output");
    expect(FLAT).toContain('`approved` only when `open` is empty');
    expect(techLine({ v: 1, prd: 'omni-loop-31', plan: SHA, settled: ['one'], open: [], outcome: 'approved' })).toMatch(/^omni tech: \{"v":1,"prd":"omni-loop-31","plan":"a{64}","settled":\["one"\],"open":\[\],"outcome":"approved"\}$/);
  });

  it('never gives the Tech Approval itself: the App gives it from the record, as the fleet\'s Architect', () => {
    expect(FLAT).toContain('never gives the Tech Approval');
    expect(FLAT).toContain("the fleet's Architect");
    expect(MISSION).not.toMatch(/omni\s+approval\s+(?!flag)/);
  });

  it('names only commands the CLI has', () => {
    for (const command of ['prd', 'dossier', 'kb']) expect(COMMAND_TABLE, command).toHaveProperty(command);
  });
});
