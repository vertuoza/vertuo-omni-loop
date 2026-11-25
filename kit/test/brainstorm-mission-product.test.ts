// PRD omni-loop-26, slice s3: the PM's skills on the server path. `/omni:brainstorm --mission <m> --cap 1
// --product <key>` writes its PRD on the product and nothing in the repository, a server repository with no
// product stops in one line, and its record names the product id; `/omni:mega-brainstorm --product <key>
// --plan-only <key>-<n>` on a mission's runner ends on the `omni plan:` record naming the pushed plan's sha256
// (kit/lib/virtual-fleet/plan-record.ts reads it). Read as text from each SKILL.md.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseProductPrdId } from '../lib/ids.ts';
import { planRecordOf } from '../lib/virtual-fleet/plan-record.ts';
import { pmRecordOf } from '../lib/virtual-fleet/pm.ts';

const BRAINSTORM = readFileSync(new URL('../plugin/skills/brainstorm/SKILL.md', import.meta.url), 'utf8');
const MEGA = readFileSync(new URL('../plugin/skills/mega-brainstorm/SKILL.md', import.meta.url), 'utf8');

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

/** The first line of `text` starting with `prefix`, trimmed. */
function lineOf(text: string, prefix: string): string {
  const line = text
    .split('\n')
    .map((raw) => raw.trim())
    .find((raw) => raw.startsWith(prefix));
  expect(line, prefix).toBeDefined();
  return line ?? '';
}

const PM = section(BRAINSTORM, "For a mission's PM");
const PM_FLAT = flat(PM);
const PLAN_ONLY = section(MEGA, 'Plan only');
const PLAN_FLAT = flat(PLAN_ONLY);

describe('/omni:brainstorm --mission --product (PRD omni-loop-26)', () => {
  it('takes --product <key> on the mission line, in its inputs', () => {
    expect(flat(section(BRAINSTORM, 'Inputs'))).toContain('`--mission <m> --cap <k> --product <key>`');
  });

  it('AC-1: on a server repository the PRD is born on the product: no issue, branch, commit or pull request', () => {
    expect(PM_FLAT).toContain('`phase 0: server`');
    expect(PM_FLAT).toContain('dossier push --product <key> --new --from <prd folder>');
    expect(PM_FLAT).toContain('`phase0: server`');
    for (const none of ['no issue', 'no branch', 'no commit', 'no pull request']) expect(PM_FLAT, none).toContain(none);
    for (const verb of ['gh issue create', 'git worktree add', 'gh pr create']) expect(PM, verb).not.toContain(verb);
  });

  it('AC-1: its record line names the product id, which the App reads', () => {
    const line = lineOf(PM, 'omni pm: ').replace('<m>', '12').replace('<k>', '1').replace('"<key>-<n>"', '"omni-loop-31"');
    expect(pmRecordOf(line, 12)?.prds).toEqual(['omni-loop-31']);
  });

  it('AC-5: a server repository with no product stops in one line and writes nothing', () => {
    expect(PM.split('\n').map((line) => line.trim())).toContain('this repository has no product: a goal-only mission needs one');
    expect(PM_FLAT).toContain('node .omni-loop/bin/omni.mjs product which');
    expect(PM_FLAT).toContain('writing nothing');
  });

  it('writes no plan: the mission plans it next, the PM approving and the Architect reviewing, with no committee vote', () => {
    expect(PM_FLAT).toContain('/omni:mega-brainstorm --product <key> --plan-only <key>-<n>');
    expect(PM_FLAT).toContain("the fleet's Architect");
    expect(PM_FLAT).toContain('no committee vote');
  });
});

describe('/omni:mega-brainstorm --plan-only on a mission (PRD omni-loop-26)', () => {
  it("ends on the omni plan: record naming the pushed plan's sha256, which the App reads", () => {
    const line = lineOf(PLAN_ONLY, 'omni plan: ');
    expect(line).toBe('omni plan: {"v":1,"prd":"<key>-<n>","plan":"<sha256>","outcome":"approved"}');
    const filled = line.replace('<key>-<n>', 'omni-loop-31').replace('<sha256>', 'b'.repeat(64));
    expect(planRecordOf(filled, parseProductPrdId('omni-loop-31'))?.plan).toBe('b'.repeat(64));
  });

  it('takes the hash from dossier get after the push, and writes no record on a stop', () => {
    const push = PLAN_FLAT.indexOf('dossier push <key>-<n> --from <prd folder>');
    const get = PLAN_FLAT.indexOf('dossier get <key>-<n> plan', push);
    expect(push).toBeGreaterThanOrEqual(0);
    expect(get).toBeGreaterThan(push);
    expect(PLAN_FLAT).toContain("the run's last output");
    expect(PLAN_FLAT).toContain('prints no record');
  });

  it("keeps the committee for a PRD a person wrote, and the PM's and the Architect's approvals for the PM's own", () => {
    expect(PLAN_FLAT).toContain('by the committee for a PRD a person wrote');
    expect(PLAN_FLAT).toContain("the fleet's Architect");
  });
});

describe("/omni:mega-brainstorm --plan-only names each repository as the mission reads it (bug #3275)", () => {
  it('always writes the Repositories table, each repo cell the full owner/name from omni targets or the spec', () => {
    expect(PLAN_FLAT).toContain('`## Repositories` table is always written');
    expect(PLAN_FLAT).toContain("its `repo` cell is that repository's full `owner/name`");
    expect(PLAN_FLAT).toContain('`omni targets --json`');
    expect(PLAN_FLAT).toContain("never the product's key, a short name or a sentence");
  });

  it('shows the row with an owner/name cell, never a bare name', () => {
    const row = lineOf(PLAN_ONLY, '| <owner>/<name> |');
    expect(row).toBe('| <owner>/<name> | <the role> | <40-character commit> | <knowledge> |');
  });
});
