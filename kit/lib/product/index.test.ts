// `omni kb index`'s layout (PRD 2299): the capped block, cut at a whole item.
import { describe, expect, it } from 'vitest';
import { INDEX_CAP_BYTES, indexLines } from './index.ts';

const know = (over: Partial<Parameters<typeof indexLines>[0]> = {}) => ({
  product: 'omni-loop',
  glossary: [
    { term: 'Workspace', meaning: 'm', avoid: ['team'] },
    { term: 'Runner', meaning: 'm', avoid: ['bot', 'worker'] },
    { term: 'Skill', meaning: 'm', avoid: [] },
  ],
  legal: [{ id: 'L-GDPR-1', statement: 'Only members read the personal data.', source: 's', owner: 'o' }],
  personas: [{ name: 'Paul', stance: 'excited' }],
  ...over,
});

describe('indexLines', () => {
  it('lays the three lists out, avoided words beside their term and a command under each', () => {
    const { lines, cut } = indexLines(know(), 'synced just now');
    expect(lines).toEqual([
      'Knowledge of omni-loop (synced just now): words to use, laws to respect, people to build for.',
      'Words: Workspace (not: team) · Runner (not: bot, worker) · Skill',
      '       → meanings: omni kb glossary',
      'Legal: L-GDPR-1 Only members read the personal data.',
      '       → sources: omni kb legal',
      'Personas: Paul (excited)',
      '       → who they are: omni business show',
    ]);
    expect(cut).toEqual({ words: 0, legal: 0, personas: 0 });
  });

  it('leaves out a list that is empty, and gives no block when all three are', () => {
    expect(indexLines(know({ personas: [], legal: [] }), 's').lines).toHaveLength(3);
    expect(indexLines(know({ personas: [], legal: [], glossary: [] }), 's').lines).toEqual([]);
  });

  it('cuts at a whole item with the count and the command, and stays within the cap', () => {
    const glossary = Array.from({ length: 400 }, (_, i) => ({ term: `Term${i}`, meaning: 'm', avoid: [`bad${i}`] }));
    const { lines, cut, shown } = indexLines(know({ glossary }), 's');
    const text = lines.join('\n');
    expect(Buffer.byteLength(text)).toBeLessThanOrEqual(INDEX_CAP_BYTES);
    expect(cut.words).toBeGreaterThan(0);
    expect(shown.words).toHaveLength(400 - cut.words);
    expect(text).toContain(`… ${cut.words} more: omni kb glossary`);
    expect(text).toContain(`Term${shown.words.length - 1} (not: bad${shown.words.length - 1}) · …`);
    expect(cut.legal + cut.personas).toBe(0);
  });

  it('gives a long list no more than its share, so the others still show', () => {
    const legal = Array.from({ length: 100 }, (_, i) => ({ id: `L-X-${i}`, statement: 'x'.repeat(80), source: 's', owner: 'o' }));
    const { lines, cut } = indexLines(know({ legal }), 's');
    expect(Buffer.byteLength(lines.join('\n'))).toBeLessThanOrEqual(INDEX_CAP_BYTES);
    expect(cut.legal).toBeGreaterThan(0);
    expect(lines.join('\n')).toContain('Paul (excited)');
  });
});
