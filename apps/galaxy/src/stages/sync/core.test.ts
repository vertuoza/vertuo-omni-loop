import { describe, expect, it } from 'vitest';
import { item } from '../../ask/test-item';
import { stagesOfRepo, syncConfig, type RepoSnapshot, type SnapshotPull } from './core';
import { parsePr, parsePrd } from 'vertuo-omni-plan/kit/lib/ids.ts';

// The sync's core (PRD 587, s2): a repository's snapshot in, the stages and topics it shows out. Pure:
// no GitHub, no database. Each test says what the repository holds.

const CONFIG = syncConfig('kit: 1\nrepo:\n  slug: acme/widgets\n  defaultBranch: trunk\nbranches:\n  feature: feature/{topic}\npaths:\n  delivery: loop/delivery\nlabels:\n  prd: product\n', 'acme/widgets');
const SYNC = '2026-09-29T12:00:00.000Z';

const pull = (number: number, head: string, more: Partial<SnapshotPull> = {}): SnapshotPull => ({
  number: parsePr(number), head, base: 'trunk', state: 'open', draft: false, merged_at: null, created_at: '2026-09-20T00:00:00Z', ready_at: null, ...more,
});
const merged = (number: number, head: string, at: string, more: Partial<SnapshotPull> = {}) => pull(number, head, { state: 'closed', merged_at: at, ...more });

const snapshot = (more: Partial<RepoSnapshot> = {}): RepoSnapshot => ({
  repository: 'Acme/Widgets', config: CONFIG, inbox: [], shipped: [], issues: [], pulls: [], ...more,
});

const stages = (snap: RepoSnapshot) => stagesOfRepo(snap, SYNC).stages.map((s) => `${s.prd} ${s.stage} ${s.reached_at}`).sort();

describe('the stages a repository shows', () => {
  it('reads its config: the delivery path, the branch shapes and the PRD label', () => {
    expect(CONFIG).toEqual({
      defaultBranch: 'trunk', delivery: 'loop/delivery', prdLabel: 'product',
      branches: { phase0: 'docs/phase-0-{topic}', slice: 'feat/{topic}--{slice}', feature: 'feature/{topic}', retro: 'docs/retro-{topic}' },
    });
  });

  it('gives shipped at the merge date of its feature PR for a folder in shipped/', () => {
    const snap = snapshot({ shipped: ['0042-dark-mode'], pulls: [merged(9, 'feature/dark-mode', '2026-09-25T10:00:00Z')] });
    expect(stages(snap)).toEqual(['42 shipped 2026-09-25T10:00:00Z']);
  });

  it('gives shipped at the sync\'s time for a folder in shipped/ whose feature PR is not found', () => {
    expect(stages(snapshot({ shipped: ['0042-dark-mode'] }))).toEqual([`42 shipped ${SYNC}`]);
  });

  it('gives PRD and inbox for a folder in inbox/ with its issue and a merged phase-0', () => {
    const snap = snapshot({
      inbox: ['0042-dark-mode'],
      issues: [{ number: parsePrd(42), created_at: '2026-09-18T08:00:00Z' }],
      pulls: [merged(5, 'docs/phase-0-dark-mode', '2026-09-19T09:00:00Z')],
    });
    expect(stages(snap)).toEqual(['42 inbox 2026-09-19T09:00:00Z', '42 prd 2026-09-18T08:00:00Z']);
  });

  it('adds building at the first merged slice PR into the feature branch', () => {
    const snap = snapshot({
      inbox: ['0042-dark-mode'],
      issues: [{ number: parsePrd(42), created_at: '2026-09-18T08:00:00Z' }],
      pulls: [
        merged(5, 'docs/phase-0-dark-mode', '2026-09-19T09:00:00Z'),
        merged(7, 'feat/dark-mode--s2', '2026-09-21T00:00:00Z', { base: 'feature/dark-mode' }),
        merged(6, 'feat/dark-mode--s1', '2026-09-20T00:00:00Z', { base: 'feature/dark-mode' }),
        pull(8, 'feat/dark-mode--s3', { base: 'feature/dark-mode' }),
        pull(9, 'feature/dark-mode', { draft: true }),
      ],
    });
    expect(stages(snap)).toEqual(['42 building 2026-09-20T00:00:00Z', '42 inbox 2026-09-19T09:00:00Z', '42 prd 2026-09-18T08:00:00Z']);
  });

  it('never counts a closed, unmerged slice PR or one of another topic', () => {
    const snap = snapshot({
      inbox: ['0042-dark-mode'],
      pulls: [
        merged(5, 'docs/phase-0-dark-mode', '2026-09-19T09:00:00Z'),
        pull(6, 'feat/dark-mode--s1', { state: 'closed', base: 'feature/dark-mode' }),
        merged(7, 'feat/dark-mode-extra--s1', '2026-09-20T00:00:00Z', { base: 'feature/dark-mode-extra' }),
      ],
    });
    expect(stages(snap)).toEqual(['42 inbox 2026-09-19T09:00:00Z']);
  });

  it('gives outbox at the ready time of an open, non-draft feature PR, and nothing for a draft one', () => {
    const ready = snapshot({ inbox: ['0042-dark-mode'], pulls: [pull(9, 'feature/dark-mode', { ready_at: '2026-09-26T00:00:00Z' })] });
    expect(stages(ready)).toContain('42 outbox 2026-09-26T00:00:00Z');
    const opened = snapshot({ inbox: ['0042-dark-mode'], pulls: [pull(9, 'feature/dark-mode', { created_at: '2026-09-24T00:00:00Z' })] });
    expect(stages(opened)).toContain('42 outbox 2026-09-24T00:00:00Z');
    const draft = snapshot({ inbox: ['0042-dark-mode'], pulls: [pull(9, 'feature/dark-mode', { draft: true })] });
    expect(stages(draft).some((s) => s.includes('outbox'))).toBe(false);
  });

  it('gives retro at the creation of a retro PR, open or merged', () => {
    const snap = snapshot({
      shipped: ['0042-dark-mode', '0043-light-mode'],
      pulls: [
        merged(9, 'feature/dark-mode', '2026-09-25T10:00:00Z'),
        pull(11, 'docs/retro-dark-mode', { created_at: '2026-09-26T00:00:00Z' }),
        merged(12, 'feature/light-mode', '2026-09-25T11:00:00Z'),
        pull(13, 'docs/retro-light-mode', { state: 'closed', created_at: '2026-09-26T00:00:00Z' }),
      ],
    });
    expect(stages(snap)).toEqual([
      '42 retro 2026-09-26T00:00:00Z', '42 shipped 2026-09-25T10:00:00Z', '43 shipped 2026-09-25T11:00:00Z',
    ]);
  });

  it('gives PRD for a labelled issue with no folder', () => {
    expect(stages(snapshot({ issues: [{ number: parsePrd(50), created_at: '2026-09-28T00:00:00Z' }] }))).toEqual(['50 prd 2026-09-28T00:00:00Z']);
  });

  it('gives inbox at the sync\'s time for a folder in inbox/ whose phase-0 PR is not found', () => {
    expect(stages(snapshot({ inbox: ['0042-dark-mode'] }))).toEqual([`42 inbox ${SYNC}`]);
  });

  it('gives nothing for a repository without an .omni-loop config', () => {
    const snap = snapshot({ config: null, shipped: ['0042-dark-mode'], issues: [{ number: parsePrd(50), created_at: '2026-09-28T00:00:00Z' }] });
    expect(stagesOfRepo(snap, SYNC)).toEqual({ stages: [], topics: [] });
  });

  it('learns each folder\'s topic from its name, and ignores a name that is not a PRD folder', () => {
    const snap = snapshot({ inbox: ['0043-light-mode', 'README.md', 'notes'], shipped: ['0042-dark-mode'] });
    expect(stagesOfRepo(snap, SYNC).topics).toEqual([
      { repository: 'acme/widgets', prd: parsePrd(42), topic: 'dark-mode' },
      { repository: 'acme/widgets', prd: parsePrd(43), topic: 'light-mode' },
    ]);
  });

  it('keeps each row\'s repository in lower case', () => {
    expect(item(stagesOfRepo(snapshot({ shipped: ['0042-dark-mode'] }), SYNC).stages, 0).repository).toBe('acme/widgets');
  });

  it('refuses a config that is not a valid Omni Loop config, naming the repository', () => {
    expect(() => syncConfig('kit: [', 'acme/widgets')).toThrow(/acme\/widgets/);
  });
});
