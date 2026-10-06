import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseConfig } from '../config.ts';
import { messageOf } from '../narrow.ts';
import { FlowSchema, hookFileViolations, hookRefProblem } from './schema.ts';

// The spec's Solution example (PRD 1089), as a repository writes it.
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

/** The first line `parseConfig` fails with on `kit: 1` plus `extra`. */
function refusal(extra: string): string {
  try {
    parseConfig(`kit: 1\n${extra}`, 'c.yml');
  } catch (error) {
    return messageOf(error).split('\n')[0] ?? '';
  }
  throw new Error('it parsed');
}

const hooks = (body: string) => `flow:\n  hooks:\n${body}`;

describe('FlowSchema', () => {
  it('reads the spec example', () => {
    const flow = parseConfig(`kit: 1\n${SPEC_FLOW}`).flow;
    expect(Object.keys(flow?.areas ?? {})).toEqual(['kernel', 'migrations']);
    expect(flow?.rules?.subPr).toEqual({ merge: 'squash', requireChecks: ['phpunit'] });
  });

  it('reads an empty flow, and a bare path as a hook', () => {
    expect(FlowSchema.parse({})).toEqual({});
    expect(FlowSchema.parse({ hooks: { 'do-work.test': 'a.md' } }).hooks).toEqual({ 'do-work.test': 'a.md' });
  });

  it.each([
    ['a regex that does not compile', "flow:\n  areas:\n    kernel:\n      paths: ['(']\n", 'flow.areas.kernel.paths.0: not a valid regular expression'],
    ['an unknown point', hooks('    do-work.lint: a.md\n'), 'flow.hooks.do-work.lint: not a point of the catalog'],
    ['replace on plan.slice', hooks('    plan.slice: { replace: a.md }\n'), 'flow.hooks.plan.slice.replace: plan.slice takes before and after hooks only'],
    ['replace on an area hook that does not allow it', "flow:\n  areas:\n    kernel:\n      paths: ['^k/']\n      hooks:\n        yolo.ready: { replace: a.md }\n", 'flow.areas.kernel.hooks.yolo.ready.replace:'],
    ['an absolute hook path', hooks('    do-work.test: /etc/hook.md\n'), 'flow.hooks.do-work.test: /etc/hook.md is an absolute path'],
    ['a hook path holding ..', hooks('    do-work.test: { after: ../hook.md }\n'), 'flow.hooks.do-work.test.after: ../hook.md holds ..'],
    ['a hook that is a URL', hooks('    do-work.test: { before: https://example.com/h.md }\n'), 'flow.hooks.do-work.test.before: https://example.com/h.md is a URL'],
    ['a hook under .claude/ without alias: claude', hooks('    pr.open: { replace: .claude/commands/pr.md }\n'), 'flow.hooks.pr.open.replace: .claude/commands/pr.md sits under .claude/'],
    ['flow.on', 'flow:\n  on:\n    merged: a.md\n', 'flow.on: reserved for events'],
    ['an area named default', "flow:\n  areas:\n    default:\n      paths: ['^a/']\n", 'flow.areas.default: default names the root of flow'],
    ['an area with no path', 'flow:\n  areas:\n    kernel:\n      paths: []\n', 'flow.areas.kernel.paths: at least one path pattern'],
    ['an unknown plan rule', 'flow:\n  rules:\n    plan:\n      - wave: last\n', 'flow.rules.plan.0:'],
    ['an unknown merge method', 'flow:\n  rules:\n    subPr: { merge: octopus }\n', 'flow.rules.subPr.merge:'],
    ['pr.openWith beside a pr.open replace', `pr:\n  openWith: /create-pr\n${hooks('    pr.open: { replace: a.md }\n')}`, 'flow.hooks.pr.open.replace: pr.openWith already replaces'],
  ])('refuses %s, naming the key', (_what, extra, expected) => {
    expect(refusal(extra)).toContain(`c.yml is not a valid Omni Loop config: ${expected}`);
  });

  it('takes a hook under .claude/, or a slash command, marked alias: claude', () => {
    const flow = parseConfig(`kit: 1\n${hooks("    pr.open: { replace: { path: /create-pr, alias: claude } }\n    do-work.ready: { path: .claude/ready.md, alias: claude }\n")}`).flow;
    expect(flow?.hooks?.['pr.open']).toEqual({ replace: { path: '/create-pr', alias: 'claude' } });
  });

  it('says why a hook path cannot be one, or null', () => {
    expect(hookRefProblem('.omni-loop/flow/a.md')).toBeNull();
    expect(hookRefProblem('a/b/..c.md')).toBeNull();
    expect(hookRefProblem({ path: '/create-pr', alias: 'claude' })).toBeNull();
    expect(hookRefProblem({ path: '/a/b.md', alias: 'claude' })).toMatch(/absolute/);
    expect(hookRefProblem('C:\\hook.md')).toMatch(/URL/);
    expect(hookRefProblem('\\hook.md')).toMatch(/absolute/);
    expect(hookRefProblem('.claude')).toMatch(/\.claude/);
  });
});

describe('hookFileViolations', () => {
  const repo = (files: Record<string, string>) => {
    const root = mkdtempSync(join(tmpdir(), 'flow-'));
    for (const [path, text] of Object.entries(files)) {
      mkdirSync(dirname(join(root, path)), { recursive: true });
      writeFileSync(join(root, path), text);
    }
    return root;
  };
  const flowOf = (yaml: string) => parseConfig(`kit: 1\n${yaml}`).flow;

  it('is quiet with no flow, and when every hook file is there and small enough', () => {
    expect(hookFileViolations(repo({}), undefined)).toEqual([]);
    const root = repo({ 'h/a.md': 'x', 'h/b.md': 'y', '.claude/c.md': 'z' });
    const flow = flowOf(`flow:\n  hooks:\n    do-work.test: { before: [h/a.md, h/b.md] }\n    pr.open: { replace: { path: /create-pr, alias: claude } }\n    do-work.ready: { path: .claude/c.md, alias: claude }\n`);
    expect(hookFileViolations(root, flow)).toEqual([]);
  });

  it('names the key of a hook file that does not exist, or is a folder', () => {
    const root = repo({ 'h/dir/x.md': 'x' });
    const flow = flowOf("flow:\n  areas:\n    kernel:\n      paths: ['^k/']\n      hooks:\n        do-work.test: { replace: h/missing.md, after: h/dir }\n");
    expect(hookFileViolations(root, flow)).toEqual([
      'flow.areas.kernel.hooks.do-work.test.replace: h/missing.md does not exist',
      'flow.areas.kernel.hooks.do-work.test.after: h/dir does not exist',
    ]);
  });

  it('names a hook file over the limit, and takes one exactly at it', () => {
    const root = repo({ 'h/big.md': 'x'.repeat(11), 'h/fit.md': 'x'.repeat(10) });
    const flow = flowOf('flow:\n  hooks:\n    yolo.ready: h/big.md\n    plan.done: h/fit.md\n');
    expect(hookFileViolations(root, flow, 10)).toEqual(['flow.hooks.yolo.ready: h/big.md is 11 bytes, over limits.hookMaxBytes (10)']);
    expect(hookFileViolations(root, flow)).toEqual([]);
  });
});
