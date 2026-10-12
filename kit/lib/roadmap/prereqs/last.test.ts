// PRD 1218, slice s2: this machine's last prerequisites result, kept in the checkout's local folder.
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseIssue } from '../../ids.ts';
import { lastResultFile, lastResultOf, readLastResult, writeLastResult } from './last.ts';
import type { LastResult } from './last.ts';

const roadmap = parseIssue(1300);

const result = (machine: string, state: 'ok' | 'waits' = 'ok'): LastResult => ({
  roadmap,
  machine,
  checkedAt: '2026-10-08T09:30:00.000Z',
  rows: [
    { id: 'p1', state, detail: state === 'ok' ? null : 'exited 1' },
    { id: 'p2', state: 'ticked', detail: null },
  ],
});

const checkout = () => mkdtempSync(join(tmpdir(), 'omni-prereqs-last-'));

describe('the last result', () => {
  it('is written and read back for the machine that ran it', () => {
    const root = checkout();
    writeLastResult(root, result('laptop-a'));
    expect(readLastResult(root, roadmap, 'laptop-a')).toEqual(result('laptop-a'));
  });

  it('is kept per machine: one machine never reads another one\'s result', () => {
    const root = checkout();
    writeLastResult(root, result('laptop-a', 'ok'));
    writeLastResult(root, result('laptop-b', 'waits'));
    expect(readLastResult(root, roadmap, 'laptop-a')?.rows[0]?.state).toBe('ok');
    expect(readLastResult(root, roadmap, 'laptop-b')?.rows[0]?.state).toBe('waits');
    expect(readLastResult(root, roadmap, 'laptop-c')).toBeNull();
  });

  it('replaces the machine\'s earlier result', () => {
    const root = checkout();
    writeLastResult(root, result('laptop-a', 'waits'));
    writeLastResult(root, result('laptop-a', 'ok'));
    expect(readLastResult(root, roadmap, 'laptop-a')?.rows[0]?.state).toBe('ok');
  });

  it('is kept per roadmap', () => {
    const root = checkout();
    writeLastResult(root, result('laptop-a'));
    expect(readLastResult(root, parseIssue(1301), 'laptop-a')).toBeNull();
  });

  it('lives in the local folder, which ignores itself', () => {
    const root = checkout();
    writeLastResult(root, result('laptop-a'));
    expect(lastResultFile(roadmap)).toBe('.omni-loop/local/prereqs/1300.json');
    expect(existsSync(join(root, lastResultFile(roadmap)))).toBe(true);
    expect(readFileSync(join(root, '.omni-loop/local/.gitignore'), 'utf8')).toBe('*\n');
  });

  it('reads as none when the file is missing, half-written or of another shape', () => {
    const root = checkout();
    expect(readLastResult(root, roadmap, 'laptop-a')).toBeNull();
    mkdirSync(join(root, '.omni-loop/local/prereqs'), { recursive: true });
    writeFileSync(join(root, lastResultFile(roadmap)), '{"laptop-a": {"roadmap": 1300');
    expect(readLastResult(root, roadmap, 'laptop-a')).toBeNull();
    writeFileSync(join(root, lastResultFile(roadmap)), JSON.stringify({ 'laptop-a': { roadmap: 1300, rows: 'none' } }));
    expect(readLastResult(root, roadmap, 'laptop-a')).toBeNull();
  });

  it('a write over a broken file starts it again', () => {
    const root = checkout();
    mkdirSync(join(root, '.omni-loop/local/prereqs'), { recursive: true });
    writeFileSync(join(root, lastResultFile(roadmap)), 'not json');
    writeLastResult(root, result('laptop-a'));
    expect(readLastResult(root, roadmap, 'laptop-a')).toEqual(result('laptop-a'));
  });
});

describe('lastResultOf', () => {
  it('keeps each row\'s id, state and detail, with the machine and the time', () => {
    const prerequisite = { id: 'p1', category: 'local' as const, need: 'n', check: 'base:docker', fix: null, blocks: 'all' as const, who: 'check' as const, repos: null, card: null };
    expect(lastResultOf([{ prerequisite, state: 'waits', detail: 'exited 1' }], { roadmap, machine: 'laptop-a', checkedAt: '2026-10-08T09:30:00.000Z' })).toEqual({
      roadmap,
      machine: 'laptop-a',
      checkedAt: '2026-10-08T09:30:00.000Z',
      rows: [{ id: 'p1', state: 'waits', detail: 'exited 1' }],
    });
  });
});
