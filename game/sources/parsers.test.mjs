import { describe, it, expect } from 'vitest';
import { parseFrontMatter, parseInbox, parseOutboxItem, parseSettled, parsePlanSlices } from './parsers.mjs';

describe('parsers', () => {
  it('reads plain key: value front matter', () => {
    expect(parseFrontMatter('---\nprd: 1015\ntitle: The inbox\n---\nbody')).toEqual({ prd: '1015', title: 'The inbox' });
  });

  it('reads an inbox file', () => {
    expect(parseInbox('---\nprd: 1015\ntitle: The inbox\nblocked-by: [966, 985]\nplan: docs/superpowers/plans/x.md\nspec: file\n---\n'))
      .toEqual({ prd: 1015, title: 'The inbox', blockedBy: [966, 985], plan: 'docs/superpowers/plans/x.md' });
    expect(parseInbox('---\nprd: 1\ntitle: t\nblocked-by: none\nplan: none\nspec: issue\n---\n').blockedBy).toEqual([]);
  });

  it('reads an outbox item', () => {
    expect(parseOutboxItem('---\nid: s7-01-default-country\nprd: 985\nslice: s7\nrank: high\nbears-on: none\nraised: 2026-09-22\nwave: 4\n---\n## What I had to decide\n'))
      .toEqual({ id: 's7-01-default-country', rank: 'high', raised: '2026-09-22' });
  });

  it('reads the settled ledger', () => {
    const text = `# Settled outbox items — PRD 1007

<!-- vertuo-outbox-settled: s1-01-customer-door -->

## s1-01-customer-door — agreed

- Verdict: agreed
- Approved by: claude-code-session (asked of clement.noterdaem inline, /vertuo-deliver)
- Approved at: 2026-09-23T07:25:59Z
- Channel: feature pull request #1021
- Rank: high

<!-- vertuo-outbox-settled: s2-01-other -->

## s2-01-other — drifted

- Verdict: drifted
- Approved by: pierrederval
- Approved at: 2026-09-24T09:00:00Z
`;
    const m = parseSettled(text);
    expect(m.get('s1-01-customer-door')).toEqual({ verdict: 'agreed', at: '2026-09-23T07:25:59Z', by: 'clement.noterdaem', rank: 'high' });
    expect(m.get('s2-01-other')).toEqual({ verdict: 'drifted', at: '2026-09-24T09:00:00Z', by: 'pierrederval', rank: null });
  });

  it('reads the slice table of a plan', () => {
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
