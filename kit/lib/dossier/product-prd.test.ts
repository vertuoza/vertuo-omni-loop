import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseProductPrdId } from '../ids.ts';
import { sha256 } from './folder.ts';
import { lastRead, LAST_READ_DIR, parseLatest, PRD_FILES, readFilesFolder, rememberLatest, writeScratch } from './product-prd.ts';

const MOBILE_12 = parseProductPrdId('mobile-12');
const PLAN = '# Plan: offline photo upload\n';
const LATEST = {
  id: 'd-12', prdId: 'mobile-12', url: 'https://omni.example/prd/d-12', kind: 'plan' as const, version: 3, sha256: sha256(PLAN), content: PLAN,
  createdAt: '2026-10-11T09:00:00.000Z',
};
const scratch = () => mkdtempSync(join(tmpdir(), 'product-prd-test-'));

describe('readFilesFolder — a product PRD\'s files, from any folder', () => {
  it('reads the spec, the plan, the before/after and the voice there, each whole with its hash, and the spec\'s title', () => {
    const dir = scratch();
    writeFileSync(join(dir, 'spec.md'), '---\ntitle: Offline photo upload\n---\n# Offline\n');
    writeFileSync(join(dir, 'plan.md'), PLAN);
    writeFileSync(join(dir, 'notes.md'), 'not sent');
    const folder = readFilesFolder(dir);
    expect(folder.title).toBe('Offline photo upload');
    expect(folder.artifacts.map(({ kind, path, sha256: hash }) => ({ kind, path, hash }))).toEqual([
      { kind: 'spec', path: join(dir, 'spec.md'), hash: sha256('---\ntitle: Offline photo upload\n---\n# Offline\n') },
      { kind: 'plan', path: join(dir, 'plan.md'), hash: sha256(PLAN) },
    ]);
    expect(folder.tooLarge).toEqual([]);
  });

  it('has no title with no spec, and names a file over 512 KiB without sending it', () => {
    const dir = scratch();
    writeFileSync(join(dir, PRD_FILES['before-after']), 'x'.repeat(512 * 1024 + 1));
    const folder = readFilesFolder(dir);
    expect(folder).toEqual({ title: null, artifacts: [], tooLarge: [{ kind: 'before-after', path: join(dir, 'before-after.html'), bytes: 512 * 1024 + 1 }] });
  });
});

describe('parseLatest — the get route\'s answer', () => {
  it('reads one, and refuses an answer missing a field or of a kind a PRD has not', () => {
    expect(parseLatest(LATEST)).toEqual(LATEST);
    expect(parseLatest({ ...LATEST, sha256: undefined })).toBeNull();
    expect(parseLatest({ ...LATEST, kind: 'bug-record' })).toBeNull();
    expect(parseLatest({ ...LATEST, version: 0 })).toBeNull();
    expect(parseLatest(null)).toBeNull();
  });
});

describe('writeScratch — the latest version, in a scratch folder of its own', () => {
  it('writes it under its file name, outside the repository, and gives the path', () => {
    const base = scratch();
    const path = writeScratch(MOBILE_12, { kind: 'plan', content: PLAN }, base);
    expect(path.startsWith(join(base, 'omni-mobile-12-'))).toBe(true);
    expect(path.endsWith('/plan.md')).toBe(true);
    expect(readFileSync(path, 'utf8')).toBe(PLAN);
    expect(writeScratch(MOBILE_12, { kind: 'plan', content: PLAN }, base)).not.toBe(path);
  });
});

describe('the last-read copy, for --show while the server is down', () => {
  it('keeps the latest read of each kind with when it was read, and gives it back', () => {
    const root = scratch();
    expect(lastRead(root, MOBILE_12, 'plan')).toBeNull();
    rememberLatest(root, MOBILE_12, LATEST, '2026-10-11T10:00:00.000Z');
    expect(existsSync(join(root, LAST_READ_DIR, 'mobile-12', 'plan.json'))).toBe(true);
    expect(lastRead(root, MOBILE_12, 'plan')).toEqual({ ...LATEST, readAt: '2026-10-11T10:00:00.000Z' });
    expect(lastRead(root, MOBILE_12, 'spec')).toBeNull();
    rememberLatest(root, MOBILE_12, { ...LATEST, version: 4 }, '2026-10-11T11:00:00.000Z');
    expect(lastRead(root, MOBILE_12, 'plan')?.version).toBe(4);
  });

  it('reads a copy half-written, or of another shape, as none', () => {
    const root = scratch();
    rememberLatest(root, MOBILE_12, LATEST, '2026-10-11T10:00:00.000Z');
    writeFileSync(join(root, LAST_READ_DIR, 'mobile-12', 'plan.json'), '{"kind":');
    expect(lastRead(root, MOBILE_12, 'plan')).toBeNull();
    writeFileSync(join(root, LAST_READ_DIR, 'mobile-12', 'plan.json'), JSON.stringify({ ...LATEST }));
    expect(lastRead(root, MOBILE_12, 'plan')).toBeNull();
  });
});
