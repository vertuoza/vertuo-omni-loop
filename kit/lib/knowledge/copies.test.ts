// An imported copy's `flow/` folder (PRD 1089, s6), as `omni check kb` grades a copy: its hook files
// are never graded as registers, and a copied flow the config would refuse is a violation.
import { describe, expect, it } from 'vitest';
import { loadContext } from '../context.ts';
import { makeRepo, realExec } from '../../test/fixture.ts';
import { gradeCopies } from './copies.ts';

const K = '.omni-loop/knowledge';
const COPY = `${K}/repos/back`;
const CONFIG = `kit: 1
repo:
  slug: acme/plan
plan:
  targets:
    - repo: acme/back
      role: back-end
      knowledge: imported
      readAt: 3f2a9c1e0b7d4c5a8e6f1d2c3b4a5968778695a4
`;
const BASE = {
  '.omni-loop/config.yml': CONFIG,
  [`${COPY}/README.md`]: '# acme/back — imported\n',
  [`${COPY}/product/principles.md`]: '# Principles\n',
  [`${COPY}/product/rules.md`]: '# Rules\n',
  [`${COPY}/product/invariants.md`]: '# Invariants\n',
};
const FLOW = "flow:\n  areas:\n    kernel:\n      paths: ['^src/kernel/']\n      hooks:\n        do-work.test: { replace: .omni-loop/flow/kernel/tests.md }\n";
const HOOK = 'omni-hook: do-work.test\n\n# Kernel tests\n\nRun them.\n\nomni-hook do-work.test: pass\n';

function grade(files: Record<string, string>) {
  const { root } = makeRepo({ git: true, files });
  return gradeCopies({ ctx: loadContext(root), exec: realExec });
}

describe('gradeCopies — a copy holding its target’s flow', () => {
  it('grades a copy with a flow and its hook files as it grades the same copy without them', () => {
    const without = grade(BASE);
    const withFlow = grade({ ...BASE, [`${COPY}/flow/config.yml`]: FLOW, [`${COPY}/flow/.omni-loop/flow/kernel/tests.md`]: HOOK });
    expect(withFlow.violations).toEqual(without.violations);
    expect(withFlow.warnings).toEqual(without.warnings);
  });

  it('refuses a copied flow the config would refuse, prefixed by the copy', () => {
    const { violations } = grade({ ...BASE, [`${COPY}/flow/config.yml`]: 'flow:\n  on: {}\n' });
    expect(violations).toContainEqual(expect.stringMatching(new RegExp(`^${COPY}: ${COPY}/flow/config\\.yml is not a valid Omni Loop config: .*on`)));
  });
});
