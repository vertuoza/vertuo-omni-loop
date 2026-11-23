// The contract of `/omni:mission` for a goal alone (PRD omni-loop-24, slice s5), read as text, as mission-skill-product.test.ts
// reads it: `--goal` writes a goal-only brief at alone asking only the fleet, `--request` reads the goal with
// `omni mission request <id>` and asks nothing, and both stop on phase 0 pr. The brief the skill describes reads through the schema.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
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

const REQUEST = '3f2a9c1e-7b4d-4e8a-9c2f-1a2b3c4d5e6f';
const brief = (extra: string) => `---\nmission: 3200\ntitle: Dark mode\nfleet: crew-bots\ngoal: Quotes get a dark mode\nmeasures: []\n${extra}mandate:\n  parallel: 2\n  level: alone\n---\n`;

describe('the mission skill, a goal alone', () => {
  const goal = section('Goal-only');

  it('AC-7: --goal writes a goal-only brief at alone asking only the fleet', () => {
    expect(goal).toContain("**`--goal '<goal>'`** takes the goal as the person gave it, word for word, and asks only the fleet's key");
    expect(goal).toContain('level: alone');
    expect(goal).toContain('**no `scope` key**');
    expect(FLAT).toContain("| `--goal '<goal>'` |");
  });

  it('AC-7: --request reads the goal with omni mission request and asks nothing', () => {
    expect(goal).toContain('node .omni-loop/bin/omni.mjs mission request <id>');
    expect(goal).toContain('It asks nothing, under `OMNI_UNATTENDED` or not');
    expect(goal).toContain('`request: <id>`');
  });

  it('AC-7: both stop with the phase 0 line on phase 0 pr, and for a member below the fleet\'s alone', () => {
    expect(goal).toContain('`phase 0: pr`');
    expect(goal).toContain('`a goal-only mission needs phase 0 on the server`');
    expect(goal).toContain('a goal-only mission works alone: an owner starts it, or raises the fleet to Works alone');
    expect(goal).toContain('Before anything is written, both forms stop');
  });

  it('never presses Start for a request, and says the mission is running', () => {
    expect(goal).toContain('Never press Start yourself');
  });

  it('writes a brief the schema reads: no scope at alone, with and without the request', () => {
    expect(parseBrief(brief('')).ok).toBe(true);
    const named = parseBrief(brief(`request: ${REQUEST}\n`));
    expect(named.ok && named.brief.request).toBe(REQUEST);
    expect(named.ok && named.brief.mandate.ownPrds).toBe(10);
  });
});
