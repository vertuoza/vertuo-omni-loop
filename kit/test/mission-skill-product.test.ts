// The contract of `/omni:mission` for product ids (PRD omni-loop-21, slice s6), read as text, as committee-skill.test.ts
// reads its skill: a scope entry may be a product PRD (`<key>-<n>`) or a product roadmap (`<key>-R<n>`); the first is
// checked with `omni prd`, the second with `omni dossier get … roadmap`, an id that does not exist is asked again, and
// the one-line form takes `--prd <key>-<n>` and `--roadmap <key>-R<n>`. The ids the skill writes are the ones the brief
// schema reads.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parse as parseYaml } from 'yaml';
import { parseBrief } from '../lib/mission/brief.ts';

const TEXT = readFileSync(fileURLToPath(new URL('../plugin/skills/mission/SKILL.md', import.meta.url)), 'utf8');
const FLAT = TEXT.replace(/\s+/g, ' ');

/** The `## <heading>` section whose heading starts with `start`, flattened, up to the next one. */
function section(start: string): string {
  const from = TEXT.indexOf(`\n## ${start}`);
  expect(from, start).toBeGreaterThanOrEqual(0);
  const to = TEXT.indexOf('\n## ', from + 1);
  return TEXT.slice(from, to < 0 ? undefined : to).replace(/\s+/g, ' ');
}

const description = (): string => {
  const match = /^---\r?\n([\s\S]*?)\r?\n---/.exec(TEXT);
  return String((parseYaml(match?.[1] ?? '') as { description?: unknown }).description);
};

const brief = (scope: string) => `---
mission: 3200
title: Dark mode
fleet: crew-bots
goal: Quotes get a dark mode
measures: []
scope:
${scope}
mandate:
  parallel: 2
  level: alone
---
`;

describe('the mission skill, product ids', () => {
  it('AC-1: the brief it writes reads with a product PRD and a product roadmap in its scope', () => {
    expect(parseBrief(brief('  prds: [2896, "omni-loop-15"]\n  roadmaps: ["omni-loop-R3"]')).ok).toBe(true);
    expect(FLAT).toContain('prds: [<PRD numbers or product PRD ids>]');
    expect(FLAT).toContain('roadmaps: [<roadmap numbers or product roadmap ids>]');
  });

  it('AC-1: the schema refuses the ids the skill tells the person to ask again', () => {
    expect(parseBrief(brief('  prds: ["omni-loop"]')).ok).toBe(false);
    expect(parseBrief(brief('  roadmaps: ["omni-loop-R"]')).ok).toBe(false);
  });

  it('says in its description that a scope takes product ids', () => {
    expect(description()).toContain('--prd <key>-<n>');
    expect(description()).toContain('--roadmap <key>-R<n>');
  });

  it('lists both one-line flags in its inputs, with the product id each takes', () => {
    const inputs = section('Inputs');
    expect(inputs).toContain('`--prd <n>` or `--prd <key>-<n>`');
    expect(inputs).toContain('`--roadmap <n>` or `--roadmap <key>-R<n>`');
    expect(inputs).toContain('/omni:mission --prd omni-loop-15');
    expect(inputs).toContain('/omni:mission --roadmap omni-loop-R3');
  });

  it('checks a product PRD with omni prd and a product roadmap with omni dossier get … roadmap', () => {
    const settle = section('1. Settle the brief');
    expect(settle).toContain('`omni prd <key>-<n>`');
    expect(settle).toContain('`omni dossier get <key>-R<n> roadmap`');
    expect(settle).toContain('a product id that does not exist is asked again');
  });

  it('keeps the one-line form asking nothing but the fleet, for a roadmap as for a PRD', () => {
    const settle = section('1. Settle the brief');
    expect(settle).toContain('With `--prd` or `--roadmap`, ask nothing');
    expect(settle).toContain('`roadmaps: [<id>]`');
    expect(FLAT).toContain('any under `--prd` or `--roadmap` beyond the fleet\'s key');
  });

  it('keeps a repository number checked as before', () => {
    expect(section('1. Settle the brief')).toContain('`omni roadmap check <n>`');
  });
});
