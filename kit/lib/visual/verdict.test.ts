// @ts-nocheck
// `visualVerdict` on the working tree (PRD 627, s4): a visual fix's folder may hold its rounds of
// variations, `variations-r<k>.html`, each checked like the before/after page, and nothing else.
import { describe, expect, it } from 'vitest';
import { makeRepo, testContext } from '../../test/fixture.ts';
import { visualVerdict } from './verdict.ts';

const DIR = '.omni-loop/delivery/visual/0012-sidebar-darker';
const PAGE = '<!doctype html><title>Sidebar</title><svg viewBox="0 0 1 1"></svg>\n';
const RASTER = '<!doctype html><img src="data:image/png;base64,iVBORw0KGgo=">\n';

function verdict(files, { cap } = {}) {
  const { root } = makeRepo({ files: Object.fromEntries(Object.entries(files).map(([name, text]) => [`${DIR}/${name}`, text])) });
  const ctx = testContext(root, { signature: null, ...(cap ? { limits: { beforeAfterMaxBytes: cap } } : {}) });
  return visualVerdict({ ctx, issue: 12 });
}

describe('visualVerdict: the rounds of variations (PRD 627)', () => {
  it('passes a folder holding before-after.html alone', () => {
    expect(verdict({ 'before-after.html': PAGE })).toEqual({ ok: true, folder: DIR, failures: [] });
  });

  it('passes a folder holding before-after.html and two rounds', () => {
    const result = verdict({ 'before-after.html': PAGE, 'variations-r1.html': PAGE, 'variations-r2.html': PAGE });
    expect(result.failures).toEqual([]);
    expect(result.ok).toBe(true);
  });

  it('passes round 10 beside round 1', () => {
    expect(verdict({ 'before-after.html': PAGE, 'variations-r1.html': PAGE, 'variations-r10.html': PAGE }).ok).toBe(true);
  });

  it('fails a round page over limits.beforeAfterMaxBytes, in one line naming it', () => {
    const result = verdict({ 'before-after.html': PAGE, 'variations-r1.html': `${PAGE}${'x'.repeat(200)}` }, { cap: 100 });
    expect(result.ok).toBe(false);
    expect(result.failures).toEqual([expect.stringMatching(/^.*variations-r1\.html: is \d+ bytes, over the 100-byte cap\.$/)]);
  });

  it('fails a round page holding a raster data:image/, in one line naming it', () => {
    const result = verdict({ 'before-after.html': PAGE, 'variations-r2.html': RASTER, 'variations-r1.html': PAGE });
    expect(result.failures).toEqual([`${DIR}/variations-r2.html: holds a base64 raster image (a data:image/ URL that is not SVG); draw it in SVG or CSS.`]);
  });

  it.each(['variations.html', 'variations-r0.html', 'variations-a.html', 'variations-r1.htm', 'variations-r01.html', 'Variations-r1.html'])(
    'fails a round named %s, in one line',
    (name) => {
      const result = verdict({ 'before-after.html': PAGE, [name]: PAGE });
      expect(result.failures).toEqual([`${DIR}/${name}: a round of variations is named variations-r<k>.html, k from 1.`]);
    },
  );

  it.each(['notes.md', 'today.png', 'scratch.html'])('fails any other file, %s, in one line', (name) => {
    const result = verdict({ 'before-after.html': PAGE, [name]: 'x\n' });
    expect(result.failures).toEqual([`${DIR}/${name}: not part of a visual fix; the folder holds before-after.html and variations-r<k>.html only.`]);
  });

  it('fails a folder inside the folder as any other file', () => {
    const result = verdict({ 'before-after.html': PAGE, 'old/variations-r1.html': PAGE });
    expect(result.failures).toEqual([`${DIR}/old: not part of a visual fix; the folder holds before-after.html and variations-r<k>.html only.`]);
  });

  it('names every failure at once, the page first, then the rounds in order, then the other files', () => {
    const result = verdict({
      'before-after.html': RASTER,
      'variations-r2.html': RASTER,
      'variations-r1.html': RASTER,
      'variations-final.html': PAGE,
      'notes.md': 'x\n',
    });
    expect(result.failures.map((line) => line.split(':')[0])).toEqual([
      `${DIR}/before-after.html`,
      `${DIR}/variations-r1.html`,
      `${DIR}/variations-r2.html`,
      `${DIR}/variations-final.html`,
      `${DIR}/notes.md`,
    ]);
  });
});
