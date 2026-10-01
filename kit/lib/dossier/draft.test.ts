// @ts-nocheck
import { describe, expect, it } from 'vitest';
import { chooseDraft } from './draft.ts';

const entry = (id, { claudeSessionId = null, prd = null } = {}) => ({
  id, url: `https://omni.example/prd/${id}`, claudeSessionId, prd, openedAt: '2026-09-27T09:00:00.000Z',
});

describe('chooseDraft', () => {
  it('chooses the unnumbered draft this terminal\'s Claude session opened, among several', () => {
    const entries = [entry('d1', { claudeSessionId: 'sess-a' }), entry('d2', { claudeSessionId: 'sess-b' }), entry('d3')];
    expect(chooseDraft(entries, { prd: 7, claudeSessionId: 'sess-b' })?.id).toBe('d2');
  });

  it('chooses the latest when this session opened several', () => {
    const entries = [entry('d1', { claudeSessionId: 'sess-a' }), entry('d2', { claudeSessionId: 'sess-a' })];
    expect(chooseDraft(entries, { prd: 7, claudeSessionId: 'sess-a' })?.id).toBe('d2');
  });

  it('chooses the only unnumbered entry when there is no session id', () => {
    expect(chooseDraft([entry('d1')], { prd: 7, claudeSessionId: null })?.id).toBe('d1');
    expect(chooseDraft([entry('d1', { claudeSessionId: 'sess-a' })], { prd: 7, claudeSessionId: null })?.id).toBe('d1');
  });

  it('chooses the only unnumbered entry opened with no session id, from a terminal that has one', () => {
    expect(chooseDraft([entry('d1')], { prd: 7, claudeSessionId: 'sess-a' })?.id).toBe('d1');
  });

  it('chooses none among several with no session id', () => {
    expect(chooseDraft([entry('d1'), entry('d2')], { prd: 7, claudeSessionId: null })).toBeNull();
    expect(chooseDraft([entry('d1'), entry('d2')], { prd: 7, claudeSessionId: 'sess-z' })).toBeNull();
  });

  it('ignores an entry numbered for another PRD', () => {
    const entries = [entry('d1', { prd: 5 }), entry('d2')];
    expect(chooseDraft(entries, { prd: 7, claudeSessionId: null })?.id).toBe('d2');
    expect(chooseDraft([entry('d1', { prd: 5 })], { prd: 7, claudeSessionId: null })).toBeNull();
  });

  it('never takes a draft another Claude session opened, from a terminal that has its own', () => {
    const entries = [entry('d1', { claudeSessionId: 'sess-a' })];
    expect(chooseDraft(entries, { prd: 7, claudeSessionId: 'sess-b' })).toBeNull();
  });

  it('takes no other draft once this PRD was numbered here: the push finds its dossier by its key', () => {
    const entries = [entry('d1', { prd: 7 }), entry('d2')];
    expect(chooseDraft(entries, { prd: 7, claudeSessionId: null })).toBeNull();
    // This session's own unnumbered draft still wins.
    const mine = [entry('d1', { prd: 7 }), entry('d2', { claudeSessionId: 'sess-a' })];
    expect(chooseDraft(mine, { prd: 7, claudeSessionId: 'sess-a' })?.id).toBe('d2');
  });

  it('chooses none when nothing is recorded', () => {
    expect(chooseDraft([], { prd: 7, claudeSessionId: 'sess-a' })).toBeNull();
  });
});
