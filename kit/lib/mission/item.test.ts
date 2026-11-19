// A mission outbox item (PRD 3065 s1): a target, a wording and cited evidence.
import { describe, expect, it } from 'vitest';
import { MissionItemSchema } from './item.ts';

const evidence = [{ text: 'Two repairs traced to the same rule.', cites: [{ kind: 'repair', ref: 3 }] }];

const item = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
  target: { kind: 'form', form: 'testing', section: 'Never' },
  wording: 'A test never leaves a clock running.',
  evidence,
  ...over,
});

const refused = (value: unknown): boolean => !MissionItemSchema.safeParse(value).success;

describe('MissionItemSchema', () => {
  it('accepts a playbook form and section, a rule id or a law id as the target', () => {
    expect(MissionItemSchema.safeParse(item()).success).toBe(true);
    expect(MissionItemSchema.safeParse(item({ target: { kind: 'rule', id: 'BR-PRODUCT-139' } })).success).toBe(true);
    expect(MissionItemSchema.safeParse(item({ target: { kind: 'law', id: 'N-PRODUCT-15' } })).success).toBe(true);
  });

  it('refuses an item missing its target, its wording or its evidence', () => {
    const { target, ...noTarget } = item();
    const { wording, ...noWording } = item();
    const { evidence: gone, ...noEvidence } = item();
    expect([target, wording, gone]).toHaveLength(3);
    expect(refused(noTarget)).toBe(true);
    expect(refused(noWording)).toBe(true);
    expect(refused(noEvidence)).toBe(true);
  });

  it('refuses an empty wording, an empty target and empty evidence', () => {
    expect(refused(item({ wording: '   ' }))).toBe(true);
    expect(refused(item({ target: { kind: 'rule', id: '' } }))).toBe(true);
    expect(refused(item({ target: { kind: 'form', form: 'testing' } }))).toBe(true);
    expect(refused(item({ target: { kind: 'form', form: '', section: 'Never' } }))).toBe(true);
    expect(refused(item({ evidence: [] }))).toBe(true);
  });

  it('refuses evidence that cites nothing, more than 5 sentences, and a credential in the wording', () => {
    expect(refused(item({ evidence: [{ text: 'No citation here.', cites: [] }] }))).toBe(true);
    expect(refused(item({ evidence: Array.from({ length: 6 }, () => evidence[0]) }))).toBe(true);
    expect(refused(item({ wording: 'Use ' + 'ghp_' + 'a'.repeat(36) + ' here.' }))).toBe(true);
  });

  it('refuses an unknown target kind and an unknown key', () => {
    expect(refused(item({ target: { kind: 'file', id: 'a.ts' } }))).toBe(true);
    expect(refused(item({ extra: true }))).toBe(true);
  });
});
