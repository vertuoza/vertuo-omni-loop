import { describe, expect, it } from 'vitest';
import { makeRepo } from '../../test/fixture.ts';
import { detectLawsSource } from './detect.ts';

describe('detectLawsSource (PRD 1739)', () => {
  it('is claudeMdInvariants when AGENTS.md alone carries the invariants heading', () => {
    const { ctx } = makeRepo({ files: { 'AGENTS.md': '# Rules\n\n## Invariants\n\n- one\n' } });
    expect(detectLawsSource({ ctx })).toBe('claudeMdInvariants');
  });

  it('is claudeMdInvariants when CLAUDE.md alone carries it, as before', () => {
    const { ctx } = makeRepo({ files: { 'CLAUDE.md': '# Rules\n\n## Invariants\n\n- one\n' } });
    expect(detectLawsSource({ ctx })).toBe('claudeMdInvariants');
  });

  it('is none when no context file carries it, or when the file holding it is not a context file', () => {
    expect(detectLawsSource({ ctx: makeRepo({ files: { 'AGENTS.md': '# Rules\n' } }).ctx })).toBe('none');
    const outside = makeRepo({ config: { paths: { context: ['AGENTS.md'] } }, files: { 'CLAUDE.md': '## Invariants\n\n- one\n' } });
    expect(detectLawsSource({ ctx: outside.ctx })).toBe('none');
  });
});
