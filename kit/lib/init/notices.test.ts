import { describe, expect, it } from 'vitest';
import { makeRepo } from '../../test/fixture.ts';
import { formatterToExclude, legacyLoopWorkflows } from './notices.ts';

describe('legacyLoopWorkflows', () => {
  it('finds each workflow that mentions the outbox, sorted, and nothing else', () => {
    const { root } = makeRepo({
      files: {
        '.github/workflows/outbox.yml': 'name: Outbox\n',
        '.github/workflows/gate.yaml': 'steps:\n  - run: node scripts/outbox-status.mjs\n',
        '.github/workflows/ci.yml': 'name: ci\n',
        '.github/workflows/notes.md': 'outbox\n',
      },
    });
    expect(legacyLoopWorkflows(root)).toEqual(['.github/workflows/gate.yaml', '.github/workflows/outbox.yml']);
  });

  it('is empty without a workflows folder', () => {
    expect(legacyLoopWorkflows(makeRepo().root)).toEqual([]);
  });
});

describe('formatterToExclude', () => {
  it('Prettier, from a config file or a package.json key, points at .prettierignore', () => {
    expect(formatterToExclude(makeRepo({ files: { '.prettierrc.json': '{}' } }).root, '.omni-loop')).toEqual({ tool: 'Prettier', file: '.prettierignore' });
    expect(formatterToExclude(makeRepo({ files: { 'package.json': '{"prettier":{}}' } }).root, '.omni-loop')).toEqual({ tool: 'Prettier', file: '.prettierignore' });
  });

  it('is null once .prettierignore names the folder, however it is written', () => {
    for (const line of ['.omni-loop', '.omni-loop/', '/.omni-loop/bin/']) {
      const { root } = makeRepo({ files: { '.prettierrc': '{}', '.prettierignore': `dist\n${line}\n` } });
      expect(formatterToExclude(root, '.omni-loop')).toBeNull();
    }
  });

  it('a commented-out line does not count', () => {
    const { root } = makeRepo({ files: { '.prettierrc': '{}', '.prettierignore': '# .omni-loop/\n' } });
    expect(formatterToExclude(root, '.omni-loop')).toEqual({ tool: 'Prettier', file: '.prettierignore' });
  });

  it('Biome points at its own config until that config names the folder', () => {
    expect(formatterToExclude(makeRepo({ files: { 'biome.json': '{}' } }).root, '.omni-loop')).toEqual({ tool: 'Biome', file: 'biome.json' });
    expect(formatterToExclude(makeRepo({ files: { 'biome.json': '{"files":{"ignore":[".omni-loop/bin"]}}' } }).root, '.omni-loop')).toBeNull();
  });

  it('is null with no formatter, or with an unreadable package.json', () => {
    expect(formatterToExclude(makeRepo().root, '.omni-loop')).toBeNull();
    expect(formatterToExclude(makeRepo({ files: { 'package.json': '{ nope' } }).root, '.omni-loop')).toBeNull();
  });
});
