import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { seenSignature, seenWatch } from './seen';
import type { TabEntry } from './view';

// The PRD page marks its PRD seen (PRD 579, s1): on mount, and again each time the versions it renders
// change while it is open (the page refreshes itself), so its New documents group leaves the bell.

const tab = (kind: TabEntry['kind'], badge: string | null): TabEntry => ({ kind, label: kind, badge, alert: null, href: `#${kind}`, current: false, empty: false });

describe('the rendered versions\' signature', () => {
  it('names each artifact\'s latest version, and nothing else', () => {
    const tabs = [tab('before-after', 'v2'), tab('spec', 'v3'), tab('plan', null), tab('questions', '7/10'), tab('outbox', '2 open')];
    expect(seenSignature(tabs)).toBe('before-after:v2|spec:v3|plan:-');
    expect(seenSignature([...tabs.slice(0, 3), tab('questions', '8/10')])).toBe(seenSignature(tabs));
    expect(seenSignature([tab('before-after', 'v2'), tab('spec', 'v4'), tab('plan', null)])).not.toBe(seenSignature(tabs));
  });
});

describe('marking the PRD seen', () => {
  it('marks the dossier on mount, and again only when the signature changes', () => {
    const mark = vi.fn();
    const watch = seenWatch('d-579', mark);
    watch('spec:v1');
    expect(mark).toHaveBeenCalledTimes(1);
    expect(mark).toHaveBeenLastCalledWith('d-579');
    watch('spec:v1');
    expect(mark).toHaveBeenCalledTimes(1);
    watch('spec:v2');
    expect(mark).toHaveBeenCalledTimes(2);
    expect(mark).toHaveBeenLastCalledWith('d-579');
  });

  it('is drawn on the PRD page, with the dossier id and the signature', () => {
    const page = readFileSync(new URL('./DossierPage.tsx', import.meta.url), 'utf8');
    expect(page).toMatch(/<MarkSeen id=\{view\.id\} signature=\{seenSignature\(view\.tabs\)\} \/>/);
    const part = readFileSync(new URL('./MarkSeen.tsx', import.meta.url), 'utf8');
    expect(part).toMatch(/^'use client';/);
    expect(part).toContain('markSeen(');
  });
});
