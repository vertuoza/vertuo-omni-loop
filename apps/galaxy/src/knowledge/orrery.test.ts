import { describe, it, expect } from 'vitest';
import { KINDS, type EntryKind, type KnowledgeEntry } from '../data/knowledge';
import { entry } from './fixture';
import { orrery, ORRERY } from './orrery';
import { sure } from '../arcade/sure';

// The page's diagram: the domain's sun in the middle, principles on the inner orbit, rules on the
// middle one, invariants outside, every entry seated, nothing overlapping.

const PREFIX: Record<EntryKind, string> = { principle: 'P', rule: 'BR', invariant: 'N' };
/** `n` entries of one kind, written out of id order. */
const many = (kind: EntryKind, n: number) =>
  Array.from({ length: n }, (_, i) => entry(`${PREFIX[kind]}-DEMO-${n - i}`, kind, 'demo'));

/** This repository's product domain today: 24 principles, 26 rules, 8 invariants. */
const PRODUCT = [...many('principle', 24), ...many('rule', 26), ...many('invariant', 8)];

function check(entries: KnowledgeEntry[]) {
  const layout = orrery(entries);
  const { size, dot } = layout;

  expect(layout.dots.map((d) => d.entry.id).sort()).toEqual(entries.map((e) => e.id).sort());

  for (const d of layout.dots) {
    expect(d.x - dot, d.entry.id).toBeGreaterThanOrEqual(0);
    expect(d.y - dot, d.entry.id).toBeGreaterThanOrEqual(0);
    expect(d.x + dot, d.entry.id).toBeLessThanOrEqual(size);
    expect(d.y + dot, d.entry.id).toBeLessThanOrEqual(size);
    expect(Math.hypot(d.x - layout.center, d.y - layout.center), d.entry.id).toBeGreaterThan(layout.sun + dot);
  }
  for (let i = 0; i < layout.dots.length; i += 1) {
    for (let j = i + 1; j < layout.dots.length; j += 1) {
      const [a, b] = [layout.dots[i], layout.dots[j]];
      expect(Math.hypot(sure(a, 'a').x - sure(b, 'b').x, sure(a, 'a').y - sure(b, 'b').y), `${sure(a, 'a').entry.id} and ${sure(b, 'b').entry.id}`).toBeGreaterThanOrEqual(2 * dot + 4);
    }
  }
  return layout;
}

describe('orrery — the page’s diagram', () => {
  it('seats every entry of this repository’s product domain, one orbit per kind, inside the diagram, none touching', () => {
    const layout = check(PRODUCT);
    expect(layout.rings.map((r) => r.kind)).toEqual(['principle', 'rule', 'invariant']);
  });

  it('puts principles inside, rules in the middle, invariants outside', () => {
    const layout = orrery(PRODUCT);
    const radius = (kind: EntryKind) => layout.dots.filter((d) => d.entry.kind === kind).map((d) => Math.round(Math.hypot(d.x - layout.center, d.y - layout.center)));
    expect(Math.max(...radius('principle'))).toBeLessThan(Math.min(...radius('rule')));
    expect(Math.max(...radius('rule'))).toBeLessThan(Math.min(...radius('invariant')));
  });

  it('seats each orbit in id order, clockwise from the top', () => {
    const layout = orrery(PRODUCT);
    const principles = layout.dots.filter((d) => d.entry.kind === 'principle');
    expect(principles.map((d) => d.entry.id)).toEqual(Array.from({ length: 24 }, (_, i) => `P-DEMO-${i + 1}`));
    expect(sure(principles[0], 'principles[0]').x).toBeCloseTo(layout.center, 5);
    expect(sure(principles[0], 'principles[0]').y).toBeLessThan(layout.center);
    expect(sure(principles[1], 'principles[1]').x).toBeGreaterThan(layout.center);
  });

  it('spills a crowded orbit outward onto more orbits of the same kind, and still seats all 150 entries', () => {
    const layout = check(many('principle', 150));
    const rings = layout.rings.filter((r) => r.kind === 'principle');
    expect(rings.length).toBeGreaterThan(1);
    expect(rings.map((r) => r.r)).toEqual([...rings.map((r) => r.r)].sort((a, b) => a - b));
    expect(layout.rings.map((r) => r.kind)).toEqual([...rings.map(() => 'principle'), 'rule', 'invariant']);
  });

  it('seats a domain of 150 entries of every kind', () => {
    check([...many('principle', 40), ...many('rule', 90), ...many('invariant', 20)]);
  });

  it('keeps an orbit for a kind the domain has none of, and draws an empty domain as its sun and three orbits', () => {
    expect(orrery(many('rule', 3)).rings.map((r) => r.kind)).toEqual([...KINDS]);
    const empty = orrery([]);
    expect(empty.dots).toEqual([]);
    expect(empty.rings).toHaveLength(3);
    expect(empty.size).toBeGreaterThan(2 * sure(empty.rings[2], 'empty.rings[2]').r);
  });

  it('keeps its constants sane: dots fit their spacing', () => {
    expect(ORRERY.spacing).toBeGreaterThanOrEqual(2 * ORRERY.dot + 4);
    expect(ORRERY.spillGap).toBeGreaterThanOrEqual(2 * ORRERY.dot + 4);
  });
});
