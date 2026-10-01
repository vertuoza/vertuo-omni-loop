// @ts-nocheck
import { describe, expect, it } from 'vitest';
import { makeRepo } from '../test/fixture.ts';
import { invariantAdrs, lawsFor } from './laws.ts';

const ADR = '.omni-loop/knowledge/adr';

describe('invariantAdrs', () => {
  it('reads the ADR ids cited under the heading, and only there', () => {
    const text = '# X\n\n## Invariants\n\n- Tenants never mix (ADR-0004)\n- Money is exact (ADR-0011, ADR-0016)\n\n## Other\n\n- (ADR-0099)\n';
    expect([...invariantAdrs(text, '## Invariants')].sort()).toEqual(['ADR-0004', 'ADR-0011', 'ADR-0016']);
  });
  it('is empty when the heading is absent', () => {
    expect(invariantAdrs('# X\n', '## Invariants').size).toBe(0);
  });
});

describe('lawsFor', () => {
  it('source none: resolves ADRs by file, floors nothing', () => {
    const { ctx } = makeRepo({ files: { [`${ADR}/0004-tenants.md`]: '# 4' } });
    const laws = lawsFor(ctx);
    expect(laws.resolve('none')).toEqual({ ok: true });
    expect(laws.resolve('ADR-0004')).toEqual({ ok: true });
    expect(laws.floorsHigh('ADR-0004')).toBe(false);
    expect(laws.resolve('BR-QUOTE-1').ok).toBe(false);
  });

  it('resolves a knowledge id under every source when the knowledge folder holds it; floors it only under knowledge', () => {
    const files = { '.omni-loop/knowledge/product/principles.md': '# Principles\n\n## P-PRODUCT-1\n\nx\n\nWhy: y\nDecided: z\nSource: PRD #3\n' };
    for (const source of ['none', 'claudeMdInvariants']) {
      const { ctx } = makeRepo({ config: { laws: { source } }, files });
      const laws = lawsFor(ctx);
      expect(laws.resolve('P-PRODUCT-1')).toEqual({ ok: true });
      expect(laws.resolve('P-PRODUCT-9').reason).toMatch(/names no entry/);
      expect(laws.floorsHigh('P-PRODUCT-1')).toBe(false);
    }
  });

  it('refuses a knowledge id when there is no knowledge folder, naming the folder', () => {
    const { ctx } = makeRepo();
    expect(lawsFor(ctx).resolve('BR-QUOTE-1').reason).toMatch(/no knowledge folder at \.omni-loop\/knowledge/);
  });

  it('refuses an ambiguous ADR number, naming both files', () => {
    const { ctx } = makeRepo({ files: { [`${ADR}/0076-a.md`]: '#', [`${ADR}/0076-b.md`]: '#' } });
    const result = lawsFor(ctx).resolve('ADR-0076');
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/ambiguous.*0076-a\.md.*0076-b\.md/s);
  });

  it('refuses a missing ADR', () => {
    const { ctx } = makeRepo();
    expect(lawsFor(ctx).resolve('ADR-0001').reason).toMatch(/no decision record ADR-0001/);
  });

  it('source claudeMdInvariants: an ADR named under the heading floors high', () => {
    const { ctx } = makeRepo({
      config: { laws: { source: 'claudeMdInvariants' } },
      files: { 'CLAUDE.md': '## Invariants\n\n- x (ADR-0004)\n', [`${ADR}/0004-a.md`]: '#', [`${ADR}/0005-b.md`]: '#' },
    });
    const laws = lawsFor(ctx);
    expect(laws.floorsHigh('ADR-0004')).toBe(true);
    expect(laws.floorsHigh('ADR-0005')).toBe(false);
  });

  it('source knowledge: a resolved id floors high, an unknown one does not resolve', () => {
    const { ctx } = makeRepo({
      config: { laws: { source: 'knowledge' } },
      files: { '.omni-loop/knowledge/product/principles.md': '# Principles\n\n## P-PRODUCT-1\n\nx\n\nWhy: y\nDecided: z\nSource: PRD #3\n' },
    });
    const laws = lawsFor(ctx);
    expect(laws.floorsHigh('P-PRODUCT-1')).toBe(true);
    expect(laws.resolve('P-PRODUCT-1')).toEqual({ ok: true });
    expect(laws.resolve('P-PRODUCT-9').ok).toBe(false);
  });

  it('a proposed id floors nothing under any source, and floors high under knowledge once its Proposed: line is removed; it resolves both ways', () => {
    const confirmed = '# Principles\n\n## P-PRODUCT-1\n\nx\n\nWhy: y\nDecided: z\nSource: PRD #3\n';
    const proposed = `${confirmed}Proposed: invade 2026-09-25\n`;
    for (const source of ['knowledge', 'claudeMdInvariants', 'none']) {
      const { ctx } = makeRepo({ config: { laws: { source } }, files: { '.omni-loop/knowledge/product/principles.md': proposed } });
      const laws = lawsFor(ctx);
      expect(laws.resolve('P-PRODUCT-1')).toEqual({ ok: true });
      expect(laws.floorsHigh('P-PRODUCT-1')).toBe(false);
    }
    const { ctx } = makeRepo({ config: { laws: { source: 'knowledge' } }, files: { '.omni-loop/knowledge/product/principles.md': confirmed } });
    expect(lawsFor(ctx).resolve('P-PRODUCT-1')).toEqual({ ok: true });
    expect(lawsFor(ctx).floorsHigh('P-PRODUCT-1')).toBe(true);
  });
});
