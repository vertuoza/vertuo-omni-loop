// PRD 2898, s1: the settings of the ready checks — `ready.checks`, `ready.full`, `acceptance.kind`,
// `e2e.ci`, `e2e.repo` — and the label `labels.readyCheck`. Its own file: `config.test.ts` proves
// rules and stays as it was, but for the sections whose whole defaults it lists.
import { describe, expect, it } from 'vitest';
import { main } from '../bin/omni.ts';
import { makeRepo } from '../test/fixture.ts';
import { messageOf } from './narrow.ts';
import { DEFAULT_READY_CHECK_LABEL, parseConfig, READY_LOOSENING_GROUND, readyCheckLabel } from './config.ts';

const firstLine = (source: string) => {
  try {
    parseConfig(source, 'c.yml');
  } catch (error) {
    return messageOf(error).split('\n')[0];
  }
  return 'parsed';
};

describe('the ready section (PRD 2898)', () => {
  it('gates nothing and names no full job when the file has no ready section', () => {
    expect(parseConfig('kit: 1\n').ready).toEqual({ checks: 'off', full: [] });
  });

  it('reads back the scope and the full jobs the file sets', () => {
    expect(parseConfig('kit: 1\nready:\n  checks: mission\n  full: [test, lint]\n').ready).toEqual({ checks: 'mission', full: ['test', 'lint'] });
    expect(parseConfig('kit: 1\nready:\n  checks: all\n').ready.checks).toBe('all');
  });

  it('refuses another scope, an empty or repeated job and an unknown key, naming the key', () => {
    expect(firstLine('kit: 1\nready:\n  checks: some\n')).toMatch(/^c\.yml.*ready\.checks/);
    expect(firstLine("kit: 1\nready:\n  full: ['']\n")).toMatch(/ready\.full/);
    expect(firstLine('kit: 1\nready:\n  full: [test, test]\n')).toMatch(/ready\.full.*test is listed twice/);
    expect(firstLine('kit: 1\nready:\n  quick: true\n')).toMatch(/ready.*quick/);
  });
});

describe('acceptance.kind (PRD 2898)', () => {
  it('is test unless the file names e2e, and refuses any other kind', () => {
    expect(parseConfig('kit: 1\n').acceptance.kind).toBe('test');
    expect(parseConfig('kit: 1\nacceptance:\n  kind: e2e\n').acceptance.kind).toBe('e2e');
    expect(firstLine('kit: 1\nacceptance:\n  kind: unit\n')).toMatch(/^c\.yml.*acceptance\.kind/);
  });

  it('keeps the acceptance rule it had: enabled still needs a folder', () => {
    expect(firstLine('kit: 1\nacceptance:\n  enabled: true\n  kind: e2e\n')).toMatch(/acceptance\.dir/);
  });
});

describe('e2e.ci and e2e.repo (PRD 2898)', () => {
  it('runs no e2e in CI and keeps the tests here when the file says nothing', () => {
    const { e2e } = parseConfig('kit: 1\n');
    expect(e2e.ci).toBe(false);
    expect(e2e.repo).toBeNull();
  });

  it('reads a repository as owner/name, and refuses anything else', () => {
    expect(parseConfig('kit: 1\ne2e:\n  ci: true\n  repo: acme/e2e-tests\n').e2e).toMatchObject({ ci: true, repo: 'acme/e2e-tests' });
    expect(firstLine('kit: 1\ne2e:\n  repo: e2e-tests\n')).toMatch(/^c\.yml.*e2e\.repo/);
    expect(firstLine('kit: 1\ne2e:\n  ci: sometimes\n')).toMatch(/e2e\.ci/);
  });
});

describe('labels.readyCheck (PRD 2898)', () => {
  it('is left out of a config that does not set it, which parses exactly as before: the kit reads omni:ready-check', () => {
    const config = parseConfig('kit: 1\n');
    expect(Object.hasOwn(config.labels, 'readyCheck')).toBe(false);
    expect(DEFAULT_READY_CHECK_LABEL).toBe('omni:ready-check');
    expect(readyCheckLabel(config.labels)).toBe('omni:ready-check');
  });

  it('is the name the file gives it, and refuses one that is no label name', () => {
    expect(readyCheckLabel(parseConfig('kit: 1\nlabels:\n  readyCheck: full-ci\n').labels)).toBe('full-ci');
    expect(firstLine("kit: 1\nlabels:\n  readyCheck: ''\n")).toMatch(/labels\.readyCheck/);
  });
});

describe('the ground a loosening is read on (PRD 2898)', () => {
  it('names the mutation floor and the two baseline folders the spec lists', () => {
    expect(READY_LOOSENING_GROUND).toEqual({ floors: ['mutation/floor.json'], baselines: ['fallow/', 'layering/'] });
  });
});

describe('omni config prints the ready settings (PRD 2898)', () => {
  const printed = async (key: string) => {
    const { root } = makeRepo({ git: true, files: { '.omni-loop/config.yml': 'kit: 1\n' } });
    const out: string[] = [];
    const code = await main(['config', key], { cwd: root, stdout: { write: (s: string) => out.push(s) }, stderr: { write: () => {} } });
    expect(code).toBe(0);
    return out.join('');
  };

  it('prints each setting with its default', async () => {
    expect(JSON.parse(await printed('ready'))).toEqual({ checks: 'off', full: [] });
    expect(await printed('acceptance.kind')).toBe('test\n');
    expect(await printed('e2e.ci')).toBe('false\n');
    expect(await printed('e2e.repo')).toBe('null\n');
  });
});
