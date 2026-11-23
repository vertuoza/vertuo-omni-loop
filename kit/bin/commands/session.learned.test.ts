// `omni session start` prints what the fleet learned (PRD omni-loop-21 s13, spec "8. The fleet remembers", AC-8), seen from the
// outside: through `main()` on a fixture repository, offline, with the file the runner leaves in a mission job's worktree.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { makeRepo } from '../../test/fixture.ts';
import { FLEET_LEARNED_FILE } from '../../lib/session/fleet-learned.ts';
import { FROM_YOUR_PEOPLE_FILE } from '../../lib/runner/fleet-messages.ts';
import { main } from '../omni.ts';

const offline = (): Promise<Response> => Promise.reject(new TypeError('fetch failed'));

/** A checkout whose local folder holds `files`. */
function checkout(files: Record<string, string>): string {
  const { root } = makeRepo({ git: true, files: { '.omni-loop/config.yml': 'kit: 1\nrepo:\n  slug: acme/widgets\n' } });
  mkdirSync(join(root, '.omni-loop', 'local'), { recursive: true });
  for (const [path, content] of Object.entries(files)) writeFileSync(join(root, path), content);
  return root;
}

async function start(root: string): Promise<string[]> {
  const out: string[] = [];
  const code = await main(['session', 'start'], {
    cwd: root, stdout: { write: (s: string) => out.push(s) }, stderr: { write: () => undefined }, env: {}, fetch: offline, now: () => 1_000_000,
    tokens: { read: () => null, write: () => undefined },
  });
  expect(code).toBe(0);
  return out.join('').trimEnd().split('\n');
}

const learned = (role: string) => JSON.stringify({
  role,
  lines: [{
    day: '2026-11-22',
    line: 'PRD 7: the fleet answered s2-01 with option A; ada overturned it.',
    events: [{ at: '2026-11-22T09:30:00Z', kind: 'overturned', sentence: 'ada overturned fleet decision 7/s2-01: rounding.' }],
  }],
});

describe('omni session start: What this fleet learned (PRD omni-loop-21 s13)', () => {
  it('AC-8: a PM, committee or Engineer job prints the fleet notebook\'s lines in a data block, after the briefing and its people, before the session', async () => {
    for (const role of ['pm', 'architect', 'engineer']) {
      const lines = await start(checkout({
        [FLEET_LEARNED_FILE]: learned(role),
        [FROM_YOUR_PEOPLE_FILE]: JSON.stringify([{ author: 'mira-k', at: '2026-11-21T09:20:00Z', text: 'hello' }]),
      }));
      const at = lines.indexOf('What this fleet learned');
      expect(at).toBeGreaterThan(lines.indexOf('From your people'));
      expect(lines.indexOf('From your people')).toBeGreaterThan(lines.indexOf('# Briefing'));
      expect(lines.slice(at + 2, at + 6)).toEqual([
        '<fleet_notebook>',
        '2026-11-22 / PRD 7: the fleet answered s2-01 with option A; ada overturned it.',
        '  event 2026-11-22 09:30 UTC / overturned / ada overturned fleet decision 7/s2-01: rounding.',
        '</fleet_notebook>',
      ]);
      expect(lines.at(-1)).toMatch(/^session: /);
    }
  });

  it('prints no block in a Reviewer\'s or QA\'s job, with no file, or with one that does not read', async () => {
    for (const files of [{ [FLEET_LEARNED_FILE]: learned('reviewer') }, { [FLEET_LEARNED_FILE]: learned('qa') }, {}, { [FLEET_LEARNED_FILE]: 'not json' }]) {
      expect(await start(checkout(files))).not.toContain('What this fleet learned');
    }
  });
});
