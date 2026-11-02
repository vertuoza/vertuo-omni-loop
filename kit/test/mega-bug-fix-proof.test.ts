// PRD 2578, s5: `/omni:mega-bug-fix` makes one proof. The point `bug-fix.proof` fires once, in the target
// where the bug shows, handed every target's pull request; the record's pull request carries the proof
// (a product bug's sits on that target's fix pull request); `omni bug` checks it; with no hook there,
// each target keeps its CI red and the `Proved on` line says the screen was not filmed.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const TEXT = readFileSync(new URL('../plugin/skills/mega-bug-fix/SKILL.md', import.meta.url), 'utf8');

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

const flat = (text: string) => text.replace(/\s+/g, ' ');

/** Each of `mentions` that `text` lacks, or lacks after the one before it. */
const gaps = (text: string, mentions: string[]) => {
  const out: string[] = [];
  const words = flat(text);
  let from = 0;
  mentions.forEach((mention: string, index: number) => {
    const at = words.indexOf(mention, from);
    if (at < 0) out.push(`${mention} after ${mentions[index - 1] ?? 'the start'}`);
    else from = at + mention.length;
  });
  return out;
};

const PROOF = section(TEXT, '7b.');

describe('/omni:mega-bug-fix makes one proof (PRD 2578)', () => {
  it('puts the proof after the targets and before the record', () => {
    expect(gaps(TEXT, ['## 7. Each target', '## 7b. The one proof', '## 8. The record', '## 9. Ship the record'])).toEqual([]);
  });

  it("fires bug-fix.proof once, in the target the triage says the bug shows in, handed every target's pull request", () => {
    expect(flat(section(TEXT, '3. Triage'))).toContain('- **Shows in:** <name>');
    expect(gaps(PROOF, [
      "once every target's PR holds its fix",
      "in the target the triage's **Shows in** line names",
      '**once**',
      'flow show bug-fix.proof',
      "`{targets}` **every** target's repository and pull request",
    ])).toEqual([]);
  });

  it('carries the proof on the record pull request, and the target pull requests carry none', () => {
    expect(flat(PROOF)).toContain('it goes on the record PR; the target PRs carry none');
    expect(flat(section(TEXT, '7. Each target'))).toContain('a target PR carries none');
    expect(flat(section(TEXT, '9. Ship the record'))).toContain('with the `## Proof` of step 7b');
  });

  it("falls back to each target's CI red, then the ladder's levels, and says the screen was not filmed", () => {
    expect(gaps(PROOF, [
      '**No hook in that target**',
      "each target keeps **today's CI red**",
      'bug ci <n>',
      'level C',
      'level D',
      'GIF not produced - A: <why>; B: <why>; C: <why>',
      'reproduction test only, the screen was not filmed',
    ])).toEqual([]);
  });

  it("checks the record's body with omni bug <n> --body-file before it is marked ready, no longer exempt", () => {
    const ship = flat(section(TEXT, '9. Ship the record'));
    expect(ship).toContain('omni.mjs bug <n> --body-file <file>');
    expect(ship).toContain('no longer exempt');
    expect(ship).not.toContain('is exempt from the proof check');
  });

  it("puts a product bug's proof on the fix pull request of the target where the bug shows, checked by omni bug check --product", () => {
    const product = flat(section(TEXT, 'From a product'));
    expect(gaps(product, [
      'goes on the fix PR of the target where the bug shows',
      'omni.mjs bug check --product <key> <file> --body-file <body>',
      'gh pr edit <pr> --repo <slug> --body-file <body>',
    ])).toEqual([]);
  });

  it('says so in its description', () => {
    expect(/^description: (.*)$/m.exec(TEXT)?.[1] ?? '').toContain('Makes one proof');
  });
});
