import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { loadContext, slugFromRemote } from './context.mjs';

describe('slugFromRemote', () => {
  it.each([
    ['git@github.com:vertuoza/some-repo.git', 'vertuoza/some-repo'],
    ['https://github.com/acme/widgets.git', 'acme/widgets'],
    ['https://github.com/acme/widgets', 'acme/widgets'],
    ['ssh://git@github.com/acme/widgets.git', 'acme/widgets'],
    ['/local/path', null],
  ])('%s → %s', (url, slug) => expect(slugFromRemote(url)).toBe(slug));
});

describe('loadContext', () => {
  it('refuses a directory outside any git repository', () => {
    const dir = mkdtempSync(join(tmpdir(), 'ctx-'));
    expect(() => loadContext(dir)).toThrow(/not inside a git repository/);
  });

  it('fills the slug from the remote when the config leaves it null', () => {
    const root = mkdtempSync(join(tmpdir(), 'ctx-'));
    execFileSync('git', ['init', '-q'], { cwd: root });
    execFileSync('git', ['remote', 'add', 'origin', 'git@github.com:acme/widgets.git'], { cwd: root });
    mkdirSync(join(root, '.omni-loop'));
    writeFileSync(join(root, '.omni-loop/config.yml'), 'kit: 1\n');
    const ctx = loadContext(join(root));
    expect(ctx.config.repo.slug).toBe('acme/widgets');
    expect(ctx.layout.dirs.inbox).toBe('.omni-loop/delivery/inbox');
    expect(ctx.markers.comment).toBe('<!-- omni-outbox -->');
    expect(Object.isFrozen(ctx)).toBe(true);
  });
});
