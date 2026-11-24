// PRD omni-loop-26, slice s3: `/omni:roadmap --mission <m> --cap <k> --product <key>`, the line a goal-only
// mission sends its PM on a repository whose phase 0 is on the server, takes the product path: its PRDs and
// its roadmap are born on the product's pages, nothing is written in the repository, a server repository with
// no product stops in one line, and the record line names product ids (kit/lib/virtual-fleet/pm.ts reads it).
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { pmRecordOf } from '../lib/virtual-fleet/pm.ts';

const TEXT = readFileSync(new URL('../plugin/skills/roadmap/SKILL.md', import.meta.url), 'utf8');

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

const PM = section(TEXT, "For a mission's PM");
const FLAT = flat(PM);

/** The record line the section shows, with its placeholders filled for mission 12, cap 2 and two product PRDs. */
function filledRecord(): string {
  const line = PM.split('\n')
    .map((raw) => raw.trim())
    .find((raw) => raw.startsWith('omni pm: '));
  expect(line).toBeDefined();
  return (line ?? '').replace('<m>', '12').replace('<k>', '2').replace('"<key>-<n>", …', '"omni-loop-31","omni-loop-32"').replace('"<title>", …', '"a third"');
}

describe('/omni:roadmap --mission --product (PRD omni-loop-26)', () => {
  it('takes --product <key> on the mission line, in its inputs', () => {
    expect(flat(section(TEXT, 'Input'))).toContain('`--mission <m> --cap <k> --product <key>`');
    expect(FLAT).toContain('--product <key>');
  });

  it('AC-1: on a server repository the PM writes on the product only: no issue, branch, commit or pull request', () => {
    expect(FLAT).toContain('`phase 0: server`');
    expect(FLAT).toContain('dossier push --product <key> --new --from <prds>/<row id>');
    expect(FLAT).toContain('roadmap push --product <key> --new');
    expect(FLAT).toContain('`phase0: server`');
    for (const none of ['no issue', 'no branch', 'no commit', 'no pull request']) expect(FLAT, none).toContain(none);
    for (const verb of ['gh issue create', 'git worktree add', 'gh pr create']) expect(PM, verb).not.toContain(verb);
  });

  it('AC-1: its record line names product ids, which the App reads as the product PRDs it wrote', () => {
    const record = pmRecordOf(filledRecord(), 12);
    expect(record?.prds).toEqual(['omni-loop-31', 'omni-loop-32']);
    expect(record?.unwritten).toEqual(['a third']);
  });

  it('AC-5: a server repository with no product stops in one line and writes nothing', () => {
    const lines = PM.split('\n').map((line) => line.trim());
    expect(lines).toContain('this repository has no product: a goal-only mission needs one');
    expect(FLAT).toContain('node .omni-loop/bin/omni.mjs product which');
    expect(FLAT).toContain('writing nothing');
  });

  it('writes no plan: the mission plans each PRD next, the PM approving it and the Architect reviewing it', () => {
    expect(FLAT).toContain('/omni:mega-brainstorm --product <key> --plan-only <key>-<n>');
    expect(FLAT).toContain("the fleet's Architect");
    expect(FLAT).toContain('no committee vote');
  });

  it('sends its items to the product PRD through --out and item relay', () => {
    expect(FLAT).toContain('item new --prd <key>-<n>');
    expect(FLAT).toContain('item relay <scratch> --prd <key>-<n>');
  });
});
