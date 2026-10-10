// `omni check config` (PRD 1089, s1): the config, its flow and the hook files the flow names.
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { makeRepo } from '../test/fixture.ts';
import { main } from './omni.ts';

function io() {
  const out: string[] = [];
  const err: string[] = [];
  return { out, err, stdout: { write: (s: string) => out.push(s) }, stderr: { write: (s: string) => err.push(s) } };
}

const HEAD = 'kit: 1\nrepo:\n  slug: acme/widgets\n';

// The spec's Solution example, and the hook files it names.
const SPEC_FLOW = `flow:
  rules:
    plan:
      - slice: { maxFiles: 15 }
    subPr: { merge: squash, requireChecks: [phpunit] }
  hooks:
    do-work.test:
      after: .omni-loop/flow/contract-tests.md
    pr.open:
      replace: .omni-loop/flow/open-pr.md
  areas:
    kernel:
      paths: ['^src/kernel/']
      knowledge: kernel
      rules:
        plan:
          - slice: { alone: true, maxFiles: 5 }
          - wave: first
          - blocks: all
        subPr: { requireChecks: [phpunit, phpstan-max], approval: person }
      hooks:
        plan.slice: { before: .omni-loop/flow/kernel/plan.md }
        do-work.test: { replace: .omni-loop/flow/kernel/tests.md }
    migrations:
      paths: ['^database/migrations/']
      rules:
        plan:
          - slice: { alone: true, maxFiles: 1 }
          - landing: alone
`;
const HOOK = 'omni-hook: do-work.test\n\nRun the tests.\n\nomni-hook do-work.test: pass\n';
const HOOK_FILES = {
  '.omni-loop/flow/contract-tests.md': HOOK,
  '.omni-loop/flow/open-pr.md': HOOK,
  '.omni-loop/flow/kernel/plan.md': HOOK,
  '.omni-loop/flow/kernel/tests.md': HOOK,
};

async function checkConfig(config: string, files: Record<string, string> = {}) {
  const { root } = makeRepo({ git: true, files: { '.omni-loop/config.yml': config, ...files } });
  const s = io();
  const code = await main(['check', 'config'], { cwd: root, ...s });
  return { code, out: s.out.join(''), err: s.err.join('') };
}

describe('omni check config', () => {
  it('is green on a config with no flow', async () => {
    const { code, out } = await checkConfig(HEAD);
    expect(code).toBe(0);
    expect(out).toMatch(/check config — \.omni-loop\/config\.yml is valid; no flow/);
  });

  it("is green on the spec's example, its hook files present", async () => {
    const { code, out } = await checkConfig(HEAD + SPEC_FLOW, HOOK_FILES);
    expect(code).toBe(0);
    expect(out).toMatch(/check config — \.omni-loop\/config\.yml is valid; flow: 2 area\(s\), every hook file present/);
  });

  it.each([
    ['a regex that does not compile', "flow:\n  areas:\n    kernel:\n      paths: ['(']\n", 'flow.areas.kernel.paths.0'],
    ['an unknown point', 'flow:\n  hooks:\n    do-work.lint: a.md\n', 'flow.hooks.do-work.lint'],
    ['replace on plan.slice', 'flow:\n  hooks:\n    plan.slice: { replace: a.md }\n', 'flow.hooks.plan.slice.replace'],
    ['an absolute hook path', 'flow:\n  hooks:\n    do-work.test: /etc/a.md\n', 'flow.hooks.do-work.test'],
    ['a hook path holding ..', 'flow:\n  hooks:\n    do-work.test: { after: ../a.md }\n', 'flow.hooks.do-work.test.after'],
    ['a hook that is a URL', 'flow:\n  hooks:\n    do-work.test: { before: https://example.com/a.md }\n', 'flow.hooks.do-work.test.before'],
    ['a hook under .claude/ without alias: claude', 'flow:\n  hooks:\n    pr.open: { replace: .claude/a.md }\n', 'flow.hooks.pr.open.replace'],
    ['flow.on', 'flow:\n  on: {}\n', 'flow.on'],
  ])('exits 1 on %s, naming the key', async (_what, flow, key) => {
    const { code, out } = await checkConfig(HEAD + flow, { 'a.md': HOOK, '.claude/a.md': HOOK });
    expect(code).toBe(1);
    expect(out).toContain('check config — the config does not hold what it claims:');
    expect(out).toContain(`${key}:`);
  });

  it('exits 1 on a hook file that does not exist, naming the key and the path', async () => {
    const others = Object.fromEntries(Object.entries(HOOK_FILES).filter(([path]) => path !== '.omni-loop/flow/kernel/tests.md'));
    const { code, out } = await checkConfig(HEAD + SPEC_FLOW, others);
    expect(code).toBe(1);
    expect(out).toContain('flow.areas.kernel.hooks.do-work.test.replace: .omni-loop/flow/kernel/tests.md does not exist');
  });

  it('exits 1 on a hook file over limits.hookMaxBytes, 20480 by default', async () => {
    const flow = 'flow:\n  hooks:\n    yolo.ready: big.md\n';
    const over = await checkConfig(HEAD + flow, { 'big.md': 'x'.repeat(20481) });
    expect(over.code).toBe(1);
    expect(over.out).toContain('flow.hooks.yolo.ready: big.md is 20481 bytes, over limits.hookMaxBytes (20480)');
    expect((await checkConfig(HEAD + flow, { 'big.md': 'x'.repeat(20480) })).code).toBe(0);
    const set = await checkConfig(`${HEAD}limits:\n  hookMaxBytes: 100\n${flow}`, { 'big.md': 'x'.repeat(101) });
    expect(set.out).toContain('over limits.hookMaxBytes (100)');
  });

  it('lists every issue of an invalid config, one per line', async () => {
    const { code, out } = await checkConfig(`${HEAD}flow:\n  on: {}\n  hooks:\n    nope: a.md\n`);
    expect(code).toBe(1);
    expect(out).toMatch(/flow\.hooks\.nope/);
    expect(out).toMatch(/flow\.on/);
  });

  it('lists a readOnly that is no boolean and a consumes naming no other target, one per line (PRD 1162)', async () => {
    const plan = [
      'plan:',
      '  targets:',
      '    - repo: acme/api',
      '      role: back-end',
      '      knowledge: none',
      '      readOnly: maybe',
      '    - repo: acme/web',
      '      role: front-end',
      '      knowledge: none',
      '      consumes: [web, mobile]',
      '',
    ].join('\n');
    const notBoolean = await checkConfig(HEAD + plan.replace('[web, mobile]', '[api]'));
    expect(notBoolean.code).toBe(1);
    expect(notBoolean.out).toMatch(/plan\.targets\.0\.readOnly/);
    const { code, out } = await checkConfig(HEAD + plan.replace('readOnly: maybe', 'readOnly: true'));
    expect(code).toBe(1);
    expect(out).toMatch(/plan\.targets\.1\.consumes\.0: web is this target itself/);
    expect(out).toMatch(/plan\.targets\.1\.consumes\.1: mobile names no other target of plan\.targets by its short name \(api\)/);
    expect((await checkConfig(HEAD + plan.replace('readOnly: maybe', 'readOnly: true').replace('[web, mobile]', '[api]'))).code).toBe(0);
  });

  it('still stops with exit 2 where there is no config to check', async () => {
    const { root } = makeRepo({ git: true, files: { 'README.md': 'x' } });
    const s = io();
    expect(await main(['check', 'config'], { cwd: root, ...s })).toBe(2);
    expect(s.err.join('')).toMatch(/not installed/);
  });

  it('runs in check all, where a missing hook file turns it red', async () => {
    const { root } = makeRepo({ git: true, files: { '.omni-loop/config.yml': `${HEAD}flow:\n  hooks:\n    yolo.ready: gone.md\n` } });
    const s = io();
    expect(await main(['check', 'all'], { cwd: root, ...s })).toBe(1);
    expect(s.out.join('')).toContain('flow.hooks.yolo.ready: gone.md does not exist');
  });

  describe('the generated section (PRD 1138)', () => {
    const GENERATED = 'generated:\n  - path: out/\n    from: [src/, lib/]\n    build: pnpm build\n  - path: api/\n    from: [app/]\n    build: node build.ts\n';
    const GROUND = {
      'package.json': JSON.stringify({ scripts: { build: 'x' } }),
      'out/bundle.mjs': 'x',
      'src/a.ts': 'x',
      'lib/b.ts': 'x',
      'api/fn.mjs': 'x',
      'app/c.ts': 'x',
      'build.ts': 'x',
    };
    const without = (path: string) => Object.fromEntries(Object.entries(GROUND).filter(([key]) => key !== path));

    it('is green when every output, source and build exists, and counts the outputs', async () => {
      const { code, out } = await checkConfig(HEAD + GENERATED, GROUND);
      expect(code).toBe(0);
      expect(out).toMatch(/check config — \.omni-loop\/config\.yml is valid; no flow; generated: 2 output\(s\), every path, source and build present/);
    });

    it.each([
      ['a path that matches nothing tracked', without('api/fn.mjs'), 'generated.1 (api/): path api/ matches no tracked file'],
      ['a from prefix that matches nothing tracked', without('lib/b.ts'), 'generated.0 (out/): from lib/ matches no tracked file'],
      ['a script the root package.json lacks', { ...GROUND, 'package.json': '{}' }, 'generated.0 (out/): build pnpm build — build is no script of the root package.json'],
      ['a node file that is not tracked', without('build.ts'), 'generated.1 (api/): build node build.ts — build.ts is not a tracked file'],
    ])('exits 1 on %s, one line naming the entry', async (_what, files, line) => {
      const { code, out } = await checkConfig(HEAD + GENERATED, files);
      expect(code).toBe(1);
      expect(out).toContain('check config — the config does not hold what it claims:');
      expect(out).toContain(line);
      expect(out.split('\n').filter((text) => text.includes('generated.'))).toHaveLength(1);
    });

    it("passes this repository's own config", async () => {
      const s = io();
      const code = await main(['check', 'config'], { cwd: fileURLToPath(new URL('../..', import.meta.url)), ...s });
      expect(s.out.join('')).toMatch(/generated: 2 output\(s\)/);
      expect(code).toBe(0);
    });
  });

  describe('laws.requireProof, labels.law and branches.law (PRD 1342)', () => {
    const LAWS = 'laws:\n  source: knowledge\n  requireProof: true\nlabels:\n  law: law\nbranches:\n  law: laws/{id}\n';
    const KB = '.omni-loop/knowledge';
    const knowledge = (enforcedBy: string): Record<string, string> => ({
      [`${KB}/product/principles.md`]: '# Principles\n\n## P-PRODUCT-1\n\nA person saves.\n\nWhy: trust.\nDecided: a person, 2026-10-09\nSource: PRD #1342\n',
      [`${KB}/product/rules.md`]: `# Rules\n\n## BR-PRODUCT-1\n\nNothing is sent without a click.\n\nServes: P-PRODUCT-1\nSource: PRD #1342\nEnforced by: ${enforcedBy}\nStated: 2026-10-09\n`,
      [`${KB}/product/invariants.md`]: '# Invariants\n',
    });
    async function checkKnowledge(config: string, files: Record<string, string>) {
      const { root } = makeRepo({ git: true, files: { '.omni-loop/config.yml': config, ...files } });
      const s = io();
      const code = await main(['check', 'knowledge'], { cwd: root, ...s });
      return { code, out: s.out.join('') };
    }

    it('is green on a config setting the three keys, and red on a requireProof that is no boolean', async () => {
      expect((await checkConfig(HEAD + LAWS)).code).toBe(0);
      const { code, out } = await checkConfig(`${HEAD}laws:\n  requireProof: sometimes\n`);
      expect(code).toBe(1);
      expect(out).toContain('laws.requireProof');
    });

    it('omni check knowledge refuses an unenforced rule once requireProof is true, naming it', async () => {
      const { code, out } = await checkKnowledge(HEAD + LAWS, knowledge('unenforced'));
      expect(code).toBe(1);
      expect(out).toContain(`${KB}/product/rules.md: BR-PRODUCT-1 — is "Enforced by: unenforced", and laws.requireProof is true`);
    });

    it('omni check knowledge accepts the same rule while requireProof is false, and a pending one either way', async () => {
      expect((await checkKnowledge(`${HEAD}laws:\n  source: knowledge\n`, knowledge('unenforced'))).code).toBe(0);
      expect((await checkKnowledge(HEAD + LAWS, knowledge('pending #12'))).code).toBe(0);
    });

    it('omni check knowledge refuses a malformed pending, naming the entry', async () => {
      const { code, out } = await checkKnowledge(HEAD + LAWS, knowledge('pending 12'));
      expect(code).toBe(1);
      expect(out).toContain(`${KB}/product/rules.md: BR-PRODUCT-1 — "Enforced by: pending 12" is not "Enforced by: pending #<n>"`);
    });
  });

  it('leaves the other guards stopping with exit 2 on an invalid config', async () => {
    const { root } = makeRepo({ git: true, files: { '.omni-loop/config.yml': `${HEAD}flow:\n  on: {}\n` } });
    const s = io();
    expect(await main(['check', 'inbox'], { cwd: root, ...s })).toBe(2);
    expect(s.err.join('')).toMatch(/flow\.on/);
  });
});
