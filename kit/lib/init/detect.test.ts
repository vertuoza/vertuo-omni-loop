import { describe, expect, it } from 'vitest';
import { makeRepo } from '../../test/fixture.ts';
import { detectCommands, detectLawsSource } from './detect.ts';

describe('detectLawsSource (PRD 1739)', () => {
  it('is claudeMdInvariants when AGENTS.md alone carries the invariants heading', () => {
    const { ctx } = makeRepo({ files: { 'AGENTS.md': '# Rules\n\n## Invariants\n\n- one\n' } });
    expect(detectLawsSource({ ctx })).toBe('claudeMdInvariants');
  });

  it('is claudeMdInvariants when CLAUDE.md alone carries it, as before', () => {
    const { ctx } = makeRepo({ files: { 'CLAUDE.md': '# Rules\n\n## Invariants\n\n- one\n' } });
    expect(detectLawsSource({ ctx })).toBe('claudeMdInvariants');
  });

  it('is none when no context file carries it, or when the file holding it is not a context file', () => {
    expect(detectLawsSource({ ctx: makeRepo({ files: { 'AGENTS.md': '# Rules\n' } }).ctx })).toBe('none');
    const outside = makeRepo({ config: { paths: { context: ['AGENTS.md'] } }, files: { 'CLAUDE.md': '## Invariants\n\n- one\n' } });
    expect(detectLawsSource({ ctx: outside.ctx })).toBe('none');
  });
});

describe('detectCommands: the setup a lockfile proposes (PRD 1804)', () => {
  const setupOf = (files: Record<string, string>): string | null => detectCommands(makeRepo({ files }).root).setup;

  it('proposes the install each lockfile names', () => {
    const cases = [
      ['pnpm-lock.yaml', 'pnpm install --frozen-lockfile'],
      ['yarn.lock', 'yarn install --immutable'],
      ['bun.lock', 'bun install --frozen-lockfile'],
      ['bun.lockb', 'bun install --frozen-lockfile'],
      ['package-lock.json', 'npm ci'],
      ['composer.lock', 'composer install'],
    ] as const;
    for (const [lock, setup] of cases) expect(setupOf({ [lock]: '' }), lock).toBe(setup);
  });

  it('takes the first lockfile that exists, in the table order', () => {
    expect(setupOf({ 'composer.lock': '', 'package-lock.json': '', 'yarn.lock': '' })).toBe('yarn install --immutable');
    expect(setupOf({ 'composer.lock': '', 'pnpm-lock.yaml': '' })).toBe('pnpm install --frozen-lockfile');
    expect(setupOf({ 'composer.lock': '', 'bun.lock': '', 'package-lock.json': '' })).toBe('bun install --frozen-lockfile');
    expect(setupOf({ 'composer.lock': '', 'package-lock.json': '' })).toBe('npm ci');
  });

  it('is null with no lockfile, whatever the scripts file', () => {
    expect(setupOf({})).toBeNull();
    expect(setupOf({ 'package.json': JSON.stringify({ scripts: { test: 'vitest' } }) })).toBeNull();
    expect(setupOf({ 'composer.json': JSON.stringify({ scripts: { test: 'phpunit' } }) })).toBeNull();
    expect(setupOf({ Makefile: 'test:\n\techo\n' })).toBeNull();
  });

  it('is read beside the scripts: a composer project with its lockfile gets both', () => {
    const files = { 'composer.json': JSON.stringify({ scripts: { test: 'phpunit' } }), 'composer.lock': '' };
    expect(detectCommands(makeRepo({ files }).root)).toEqual({ setup: 'composer install', test: 'composer test', preflight: 'composer test', preflightFull: 'composer test' });
  });

  it('a lockfile alone, with no scripts file, proposes the setup and nothing else', () => {
    expect(detectCommands(makeRepo({ files: { 'pnpm-lock.yaml': '' } }).root)).toEqual({ setup: 'pnpm install --frozen-lockfile', test: null, preflight: null, preflightFull: null });
  });
});
