import { describe, expect, it } from 'vitest';
import { makeRepo } from '../../test/fixture.mjs';
import { parseForm } from './forms.mjs';
import { blankForm, writeForms } from './write-forms.mjs';

describe('blankForm', () => {
  it('writes decisions blank whatever the spelling of the front door’s adr/ folder', () => {
    for (const adr of ['.omni-loop/knowledge/adr', '.omni-loop/knowledge/adr/', './.omni-loop/knowledge//adr']) {
      const { ctx } = makeRepo({ config: { paths: { adr } } });
      expect(parseForm(blankForm('decisions', { ctx })).form.state, adr).toBe('blank');
    }
  });

  it('points decisions at a folder under the front door’s adr/, which is not the front door’s adr/ itself', () => {
    const { ctx } = makeRepo({ config: { paths: { adr: '.omni-loop/knowledge/adr/records' } } });
    expect(parseForm(blankForm('decisions', { ctx })).form).toMatchObject({ state: 'pointer', pointsTo: '.omni-loop/knowledge/adr/records' });
  });

  it('writes glossary blank when no glossary is set', () => {
    const { ctx } = makeRepo();
    expect(parseForm(blankForm('glossary', { ctx })).form).toMatchObject({ state: 'blank', pointsTo: null, slots: [expect.objectContaining({ id: 'where' })] });
  });
});

describe('writeForms', () => {
  it('writes only the registers that are missing, and never touches one that exists', () => {
    const { ctx, read } = makeRepo({ files: { '.omni-loop/knowledge/product/rules.md': '# Rules\n\nOurs.\n' } });
    const registers = writeForms({ ctx }).filter(({ path }) => path.includes('/product/'));
    expect(registers).toEqual([
      { path: '.omni-loop/knowledge/product/principles.md', wrote: true },
      { path: '.omni-loop/knowledge/product/rules.md', wrote: false },
      { path: '.omni-loop/knowledge/product/invariants.md', wrote: true },
    ]);
    expect(read('.omni-loop/knowledge/product/rules.md')).toBe('# Rules\n\nOurs.\n');
    expect(read('.omni-loop/knowledge/product/principles.md')).toBe('# Product principles\n\nNone yet.\n');
  });

  it('writes the forms under a playbook folder the config moved, and its parent is the front door', () => {
    const { ctx, read } = makeRepo({ config: { paths: { playbook: 'handbook/playbook', knowledge: 'handbook' } } });
    const paths = writeForms({ ctx }).map(({ path }) => path);
    expect(paths).toContain('handbook/README.md');
    expect(paths).toContain('handbook/playbook/testing.md');
    expect(paths).toContain('handbook/adr/README.md');
    expect(paths).toContain('handbook/product/rules.md');
    // The decision records stay at the default, outside this front door: the decisions form points there.
    expect(parseForm(read('handbook/adr/README.md')).form.pointsTo).toBe('.omni-loop/knowledge/adr');
  });
});
