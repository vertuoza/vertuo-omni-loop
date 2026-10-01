// @ts-nocheck
import { describe, it, expect } from 'vitest';
import { parseFrontMatter, parseSpec, deliveryOf, prdOfFolder, parseOutboxItem, parseSettled, parsePlanSlices } from './parsers.ts';

describe('parsers', () => {
  it('reads plain key: value front matter', () => {
    expect(parseFrontMatter('---\nprd: 1015\ntitle: The inbox\n---\nbody')).toEqual({ prd: '1015', title: 'The inbox' });
  });

  it('reads a spec\'s blockers, and none from a spec that says none or does not read', () => {
    expect(parseSpec('---\nprd: 728\ntitle: T\nblocked-by: [966, #985]\nspec: file\n---\n')).toEqual({ blockedBy: [966, 985] });
    expect(parseSpec('---\nprd: 1\nblocked-by: none\n---\n').blockedBy).toEqual([]);
    expect(parseSpec('## no front matter').blockedBy).toEqual([]);
    expect(parseSpec('').blockedBy).toEqual([]);
  });

  it('reads a repository\'s delivery folder from its config, the kit\'s default otherwise', () => {
    expect(deliveryOf('paths:\n  delivery: ./docs/delivery/\n')).toBe('docs/delivery');
    expect(deliveryOf('dossier:\n  enabled: true\n')).toBe('.omni-loop/delivery');
    expect(deliveryOf('')).toBe('.omni-loop/delivery');
    expect(deliveryOf('paths: [unclosed')).toBe('.omni-loop/delivery');
  });

  it('reads a PRD folder\'s number from its name', () => {
    expect(prdOfFolder('0088-points')).toBe(88);
    expect(prdOfFolder('0728-points-every-repo')).toBe(728);
    for (const bad of ['README.md', '88-short', '0000-zero', '0088-Bad_Topic']) expect(prdOfFolder(bad)).toBeNull();
  });

  it('reads an outbox item', () => {
    expect(parseOutboxItem('---\nid: s7-01-default-country\nprd: 985\nslice: s7\nrank: high\nbears-on: none\nraised: 2026-09-22\nwave: 4\n---\n## What I had to decide\n'))
      .toEqual({ id: 's7-01-default-country', rank: 'high', raised: '2026-09-22' });
  });

  it('reads the settled ledger, whatever the marker prefix', () => {
    const text = `# Settled outbox items — PRD 1007

<!-- vertuo-outbox-settled: s1-01-customer-door -->

## s1-01-customer-door — agreed

- Verdict: agreed
- Approved by: claude-code-session (asked of clement.noterdaem inline, /vertuo-deliver)
- Approved at: 2026-09-23T07:25:59Z
- Channel: feature pull request #1021
- Rank: high

<!-- omni-outbox-settled: s2-01-other -->

## s2-01-other — drifted

- Verdict: drifted
- Approved by: pierrederval
- Approved at: 2026-09-24T09:00:00Z

<!-- /omni-outbox-settled: s2-01-other -->
`;
    const m = parseSettled(text);
    expect(m.get('s1-01-customer-door')).toEqual({ verdict: 'agreed', at: '2026-09-23T07:25:59Z', by: 'clement.noterdaem', rank: 'high' });
    expect(m.get('s2-01-other')).toEqual({ verdict: 'drifted', at: '2026-09-24T09:00:00Z', by: 'pierrederval', rank: null });
    expect([...m.keys()]).toEqual(['s1-01-customer-door', 's2-01-other']);
  });

  it('reads who settled an item: nobody is no one, a delegated session is the person it answered for', () => {
    const entry = (by) => parseSettled(`<!-- omni-outbox-settled: s1-01-a -->\n\n- Verdict: agreed\n- Approved by: ${by}\n- Approved at: 2026-09-29\n`).get('s1-01-a').by;
    expect(entry('nobody')).toBeNull();
    expect(entry('claude-code-session (delegated by pierre-derval)')).toBe('pierre-derval');
    expect(entry('paul-w')).toBe('paul-w');
  });

  it('reads the slice table of the kit\'s plan', () => {
    const text = `## Slices

| id | slice | territory | blocked by | wave |
| --- | --- | --- | --- | --- |
| s1 | A tracer | \`game/sources/\` \`game/projector\` | — | 1 |
| s2 | Fresh start | \`game/projector\` | s1 | 2 |
| s4 | Arcade | \`apps/\` | s1, s2 | 3 |
`;
    expect(parsePlanSlices(text)).toEqual([
      { id: 's1', blockedBy: [], wave: 1 },
      { id: 's2', blockedBy: ['s1'], wave: 2 },
      { id: 's4', blockedBy: ['s1', 's2'], wave: 3 },
    ]);
  });

  it('reads an older slice table with more columns', () => {
    const text = `## Slices

| id  | slice | scenarios | territory | blocked by | wave | tier |
| --- | ----- | --------- | --------- | ---------- | ---- | ---- |
| s1  | A     | —         | \`a/\`    | —          | 1    | mid  |
| s4  | D     | —         | \`d/\`    | s1, s2, s3 | 2    | top  |
`;
    expect(parsePlanSlices(text)).toEqual([
      { id: 's1', blockedBy: [], wave: 1 },
      { id: 's4', blockedBy: ['s1', 's2', 's3'], wave: 2 },
    ]);
  });
});
