// The manifest of a job's save (PRD 2809, s4): what the runner sends the app once it saved a job's work, read by
// `CheckpointManifestSchema` on both sides (the app's contract re-exports it). It says what the bundle holds,
// never a file's content: per branch its name, its checkpoint ref, its base and head commits, its files and
// commits saved; the bundle's bytes; the handoff note, masked and cut to 8 KB. A credential never reaches it.
import { describe, expect, it } from 'vitest';
import { CHECKPOINT_BYTES_MAX, CheckpointManifestSchema, HANDOFF_BYTES_MAX, manifestHandoff } from './checkpoint.manifest.ts';
import type { CheckpointManifest } from './checkpoint.manifest.ts';

const HEAD = 'a'.repeat(40);
const BASE = 'b'.repeat(40);

const MANIFEST: CheckpointManifest = {
  job: '00000000-0000-4000-8000-000000000a01',
  runner: 'box-1',
  repo: 'acme/widgets',
  kind: 'portable',
  savedAt: '2027-01-20T10:00:00.000Z',
  keepUntil: '2027-01-27T10:00:00.000Z',
  bundleBytes: 2048,
  bytes: 1_048_576,
  branches: [
    { branch: 'feat/x--s3', ref: 'refs/heads/omni-checkpoint/feat/x--s3', path: 'slices/s3', base: BASE, head: HEAD, files: 3, commits: 1 },
    { branch: null, ref: 'refs/heads/omni-checkpoint/detached/root', path: '.', base: null, head: HEAD, files: 0, commits: 2 },
  ],
  handoff: 'Done: s3 tests. Next: the route.',
  failed: null,
};

describe('CheckpointManifestSchema', () => {
  it('reads a portable and a local manifest as they are', () => {
    expect(CheckpointManifestSchema.parse(MANIFEST)).toEqual(MANIFEST);
    const local = { ...MANIFEST, kind: 'local', handoff: null, failed: 'the upload failed: unreachable' };
    expect(CheckpointManifestSchema.parse(local)).toEqual(local);
  });

  it('refuses a key it does not know, so nothing beyond what it names travels (a folder on the runner, a file)', () => {
    expect(CheckpointManifestSchema.safeParse({ ...MANIFEST, folder: '/home/olga/wt/acme-job-1' }).success).toBe(false);
    expect(CheckpointManifestSchema.safeParse({ ...MANIFEST, branches: [{ ...MANIFEST.branches[0], content: 'SECRET=1' }] }).success).toBe(false);
  });

  it('refuses a ref outside omni-checkpoint/, a commit that is no object id, and a negative count', () => {
    const branch = MANIFEST.branches[0];
    for (const bad of [{ ref: 'refs/heads/main' }, { head: 'HEAD' }, { base: 'not-a-sha' }, { files: -1 }, { commits: 1.5 }]) {
      expect(CheckpointManifestSchema.safeParse({ ...MANIFEST, branches: [{ ...branch, ...bad }] }).success).toBe(false);
    }
  });

  it('refuses a portable bundle over 100 MB, and a save of no branch that did not fail', () => {
    expect(CheckpointManifestSchema.safeParse({ ...MANIFEST, bundleBytes: CHECKPOINT_BYTES_MAX + 1 }).success).toBe(false);
    expect(CheckpointManifestSchema.safeParse({ ...MANIFEST, kind: 'local', bundleBytes: CHECKPOINT_BYTES_MAX + 1 }).success).toBe(true);
    expect(CheckpointManifestSchema.safeParse({ ...MANIFEST, branches: [] }).success).toBe(false);
    expect(CheckpointManifestSchema.safeParse({ ...MANIFEST, kind: 'local', branches: [], failed: 'the save failed: disk full' }).success).toBe(true);
  });

  it('refuses a handoff note over 8 KB, or one that still holds a credential', () => {
    expect(CheckpointManifestSchema.safeParse({ ...MANIFEST, handoff: 'é'.repeat(HANDOFF_BYTES_MAX / 2 + 1) }).success).toBe(false);
    const token = ['ghs', 'fakeTokenOfTheJob0123456789ABCDEF'].join('_');
    expect(CheckpointManifestSchema.safeParse({ ...MANIFEST, handoff: `push with ${token}` }).success).toBe(false);
    expect(CheckpointManifestSchema.safeParse({ ...MANIFEST, failed: `refused: Bearer ${token}` }).success).toBe(false);
  });
});

describe('manifestHandoff()', () => {
  it('masks the job’s own secrets and every token-shaped string, as logs are', () => {
    const token = ['ghs', 'fakeTokenOfTheJob0123456789ABCDEF'].join('_');
    const note = manifestHandoff(`Pushed with ${token}; the account key is plain-key-42.`, ['plain-key-42']);
    expect(note).not.toContain(token);
    expect(note).not.toContain('plain-key-42');
    expect(CheckpointManifestSchema.safeParse({ ...MANIFEST, handoff: note }).success).toBe(true);
  });

  it('cuts the note to 8 KB on a character’s first byte, keeping its start, and reads an empty note as none', () => {
    const note = manifestHandoff(`${'é'.repeat(5000)}END`, []);
    expect(note).not.toBeNull();
    expect(new TextEncoder().encode(note ?? '').length).toBeLessThanOrEqual(HANDOFF_BYTES_MAX);
    expect(note?.startsWith('éé')).toBe(true);
    expect(note).not.toContain('�');
    expect(manifestHandoff('   \n', [])).toBeNull();
    expect(manifestHandoff(null, [])).toBeNull();
  });
});
