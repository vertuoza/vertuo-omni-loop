// The cache of `omni sync` (PRD 1990): what one run writes reads back the same, a file that does not
// read is absent, the lock is held for 2 minutes, and the module reaches no process and no network.
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { readSyncCache, releaseSyncLock, SYNC_FILE, SYNC_LOCK, syncLockHeld, takeSyncLock, writeSyncCache } from './cache.ts';
import type { SyncRecord } from './schema.ts';

const NOW = Date.parse('2026-10-15T12:00:00Z');
const RECORD: SyncRecord = {
  checkedAt: '2026-10-15T12:00:00.000Z',
  status: 'orange',
  headline: 'on feat/x: plans are made on main',
  setupDoneAt: '2026-10-01T09:00:00.000Z',
  setup: null,
  findings: [{ check: 'main', severity: 'orange', text: 'on feat/x: plans are made on main', fix: 'omni sync --fix' }],
  fix: 'omni sync --fix  (switches to main)',
};

const tempRoot = () => mkdtempSync(join(tmpdir(), 'omni-sync-cache-'));

describe('the sync cache', () => {
  it('reads back what a run wrote, in the local folder git ignores', () => {
    const root = tempRoot();
    expect(readSyncCache(root)).toBeNull();
    writeSyncCache(root, RECORD);
    expect(readSyncCache(root)).toEqual(RECORD);
    expect(JSON.parse(readFileSync(join(root, SYNC_FILE), 'utf8'))).toEqual(RECORD);
    expect(readFileSync(join(root, '.omni-loop/local/.gitignore'), 'utf8')).toBe('*\n');
  });

  it('reads a file that is half-written, of another shape or of an unknown status as absent', () => {
    const root = tempRoot();
    mkdirSync(join(root, '.omni-loop/local'), { recursive: true });
    for (const text of ['{"checkedAt":', '[]', JSON.stringify({ ...RECORD, status: 'purple' }), JSON.stringify({ ...RECORD, extra: 1 }), JSON.stringify({ ...RECORD, checkedAt: 'yesterday' })]) {
      writeFileSync(join(root, SYNC_FILE), text);
      expect(readSyncCache(root), text).toBeNull();
    }
  });

  it('holds the lock for 2 minutes, takes over an older one, and lets its own go', () => {
    const root = tempRoot();
    expect(syncLockHeld(root, NOW)).toBe(false);
    const owner = takeSyncLock(root, NOW);
    expect(owner).not.toBeNull();
    expect(syncLockHeld(root, NOW + 119_000)).toBe(true);
    expect(takeSyncLock(root, NOW + 60_000)).toBeNull();
    expect(syncLockHeld(root, NOW + 120_000)).toBe(false);
    const late = takeSyncLock(root, NOW + 120_000);
    expect(late).not.toBeNull();
    releaseSyncLock(root, owner ?? '');
    expect(syncLockHeld(root, NOW + 121_000)).toBe(true);
    releaseSyncLock(root, late ?? '');
    expect(syncLockHeld(root, NOW + 121_000)).toBe(false);
    writeFileSync(join(root, SYNC_LOCK), 'not json');
    expect(syncLockHeld(root, NOW)).toBe(false);
  });

  it('imports no child process, no git and nothing that reaches the network', () => {
    const source = readFileSync(fileURLToPath(new URL('./cache.ts', import.meta.url)), 'utf8');
    const imports = [...source.matchAll(/^import .* from '([^']+)';$/gm)].map((match) => match[1]);
    expect(imports).toEqual(['node:fs', 'node:path', 'zod', '../ask/local-state.ts', '../statusline/board-cache.ts', './schema.ts', './schema.ts']);
  });
});
