// A target's copied flow (PRD 1089, s6): read from `<paths.knowledge>/repos/<name>/flow/` of a
// fixture plan repository, compared, and its hook files listed. No test reads a target.
import { describe, expect, it } from 'vitest';
import { parseConfig } from '../config.ts';
import { makeRepo } from '../../test/fixture.ts';
import { flowKey, hasFlow, hookPaths, NO_FLOW, parseFlowConfig, readCopyFlow, targetFlows } from './copy-flow.ts';

const SHA = '3f2a9c1e0b7d4c5a8e6f1d2c3b4a5968778695a4';
const PLAN = `kit: 1
repo:
  slug: acme/plan
plan:
  targets:
    - repo: acme/back
      role: back-end
      knowledge: imported
      readAt: ${SHA}
    - repo: acme/web
      role: front-end
      knowledge: own
    - repo: acme/legacy
      role: legacy
      knowledge: imported
      readAt: ${SHA}
`;
const BACK_FLOW = `flow:
  areas:
    kernel:
      paths: ['^src/kernel/']
      hooks:
        do-work.test: { replace: .omni-loop/flow/kernel/tests.md }
`;
const COPY = '.omni-loop/knowledge/repos';

describe('parseFlowConfig', () => {
  it('keeps flow, landings and pr.openWith, and ignores every other key of a whole config', () => {
    const read = parseFlowConfig(`kit: 1\nrepo:\n  slug: acme/back\npr:\n  openWith: /create-pr\nlandings:\n  alone: ['^db/']\n${BACK_FLOW}`, 'x.yml');
    expect(read.landings.alone).toEqual(['^db/']);
    expect(read.pr.openWith).toBe('/create-pr');
    expect(Object.keys(read.flow?.areas ?? {})).toEqual(['kernel']);
  });

  it("refuses a flow the config would refuse, naming the file", () => {
    expect(() => parseFlowConfig('flow:\n  on: {}\n', 'repos/back/flow/config.yml')).toThrow(/repos\/back\/flow\/config\.yml .*on/);
    expect(() => parseFlowConfig('flow: [', 'repos/back/flow/config.yml')).toThrow(/not valid YAML/);
  });

  it('reads no key as the kit defaults', () => {
    expect(parseFlowConfig('', 'x')).toEqual(NO_FLOW);
    expect(hasFlow(NO_FLOW)).toBe(false);
    expect(hasFlow(parseFlowConfig(BACK_FLOW, 'x'))).toBe(true);
  });
});

describe('flowKey and hookPaths', () => {
  it('reads the same flow written in another key order as the same', () => {
    const a = parseFlowConfig("flow:\n  rules:\n    subPr: { merge: rebase, approval: person }\n", 'a');
    const b = parseFlowConfig("flow:\n  rules:\n    subPr: { approval: person, merge: rebase }\n", 'b');
    expect(flowKey(a)).toBe(flowKey(b));
    expect(flowKey(a)).not.toBe(flowKey(NO_FLOW));
  });

  it('lists each hook file once, never a Claude-only command', () => {
    const config = parseFlowConfig(`pr:\n  openWith: /create-pr\nflow:\n  hooks:\n    do-work.test: a.md\n  areas:\n    kernel:\n      paths: ['^k/']\n      hooks:\n        do-work.test: { before: b.md, replace: c.md }\n`, 'x');
    expect(hookPaths(config).sort()).toEqual(['a.md', 'b.md', 'c.md']);
  });
});

describe('readCopyFlow and targetFlows', () => {
  it("reads an imported target's copied flow and its hook files, and leaves out a target with none", () => {
    const { root } = makeRepo({
      files: {
        '.omni-loop/config.yml': PLAN,
        [`${COPY}/back/flow/config.yml`]: BACK_FLOW,
        [`${COPY}/back/flow/.omni-loop/flow/kernel/tests.md`]: 'omni-hook: do-work.test\n\nRun the kernel tests.\n',
        [`${COPY}/legacy/README.md`]: '# legacy\n',
      },
    });
    const config = parseConfig(PLAN);
    const copy = readCopyFlow('acme/back', { root, config });
    expect(copy?.folder).toBe(`${COPY}/back/flow`);
    expect(copy?.readHook('.omni-loop/flow/kernel/tests.md')).toMatch(/Run the kernel tests/);
    expect(copy?.readHook('.omni-loop/flow/none.md')).toBeNull();
    expect(readCopyFlow('acme/legacy', { root, config })).toBeNull();

    const flows = targetFlows({ root, config });
    expect([...flows.keys()]).toEqual(['back']);
    expect(flows.get('back')).toMatchObject({ ok: true });
  });

  it('marks a copied flow that cannot be read, naming its file', () => {
    const { root } = makeRepo({ files: { '.omni-loop/config.yml': PLAN, [`${COPY}/back/flow/config.yml`]: 'flow:\n  areas:\n    kernel:\n      paths: ["("]\n' } });
    expect(targetFlows({ root, config: parseConfig(PLAN) }).get('back')).toEqual({
      ok: false,
      file: `${COPY}/back/flow/config.yml`,
      reason: expect.stringMatching(/regular expression/),
    });
  });

  it('is empty outside a plan repository', () => {
    const { root } = makeRepo();
    expect(targetFlows({ root, config: parseConfig('kit: 1\n') }).size).toBe(0);
  });
});
