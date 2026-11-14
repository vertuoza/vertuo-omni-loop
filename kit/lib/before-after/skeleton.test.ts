// PRD 2239, s2: the before/after skeleton and the services list, pure; the page it writes passes s1's grading.
// PRD 2850, s1: the skeleton writes a version 3 page: three tabs, one Pixel perfect section for the page.
import { describe, expect, it } from 'vitest';
import { kitTemplate } from '../playbook/templates.ts';
import { parsePrd } from '../ids.ts';
import { gradeBeforeAfter } from './grade.ts';
import { beforeAfterSkeleton, parseServices } from './skeleton.ts';

const page = (services: string[]) => beforeAfterSkeleton({ template: kitTemplate('before-after/page.html'), prd: parsePrd(2239), services });
const FILL = '<!-- FILL -->';
const V3 = '<meta name="omni-before-after" content="3">';
/** The same page under the version 2 meta: today's two-tab rules (the states, the FILL marks, the resources loaded) read it whole. */
const asVersion2 = (html: string): string => html.replace(V3, '<meta name="omni-before-after" content="2">');
const grade = (html: string): string[] => gradeBeforeAfter({ file: 'before-after.html', html, prd: parsePrd(2239) });

/** The text of the `<section data-tab="<tab>">`, up to the next tab or the end of the body. */
function tab(html: string, name: string): string {
  const start = html.indexOf(`<section data-tab="${name}">`);
  const next = html.indexOf('<section data-tab="', start + 1);
  return html.slice(start, next === -1 ? html.indexOf('</body>') : next);
}

describe('beforeAfterSkeleton', () => {
  it('carries the version 3 meta, the three tabs in order with the first checked, and the hash script', () => {
    const html = page(['kit']);
    expect(html).toContain(V3);
    expect(html).not.toContain('content="2"');
    const order = ['data-tab="functional"', 'data-tab="technical"', 'data-tab="pixel-perfect"'].map((mark) => html.indexOf(mark));
    expect(order[0]).toBeGreaterThan(0);
    expect(order).toEqual([...order].sort((a, b) => a - b));
    expect(html).toMatch(
      /id="tab-functional" class="tab-input" checked>\s*<input type="radio" name="tab" id="tab-technical" class="tab-input">\s*<input type="radio" name="tab" id="tab-pixel-perfect" class="tab-input">/,
    );
    expect(html).toMatch(/<label for="tab-functional">Functional<\/label><label for="tab-technical">Technical<\/label><label for="tab-pixel-perfect">Pixel perfect<small data-count><\/small><\/label>/);
    for (const hash of ["'#technical'", "'#pixel-perfect'", "'#s-'"]) expect(html, hash).toContain(hash);
    expect(html).toContain('PRD 2239');
    expect(html).not.toContain('{{');
  });

  it('holds one data-service block per service in the Functional and Technical tabs, in the order named, and none in Pixel perfect', () => {
    const html = page(['kit', 'galaxy']);
    const functional = tab(html, 'functional');
    const technical = tab(html, 'technical');
    for (const part of [functional, technical]) {
      expect(part.match(/data-service="/g)).toHaveLength(2);
      expect(part.indexOf('data-service="kit"')).toBeLessThan(part.indexOf('data-service="galaxy"'));
    }
    expect(functional.match(/data-section="[^"]*"/g)).toEqual(['data-section="functional"', 'data-section="functional"']);
    expect(technical.match(/data-section="(db|api|behaviour)"/g)).toHaveLength(6);
    expect(technical).toContain('data-section="flow"');
    expect(technical).toContain('data-section="deploy"');
    expect(tab(html, 'pixel-perfect')).not.toContain('data-service=');
  });

  it('writes one pixel-perfect section, for the page, inside the Pixel perfect tab', () => {
    const html = page(['kit', 'galaxy']);
    expect(html.match(/data-section="pixel-perfect"/g)).toHaveLength(1);
    expect(tab(html, 'pixel-perfect')).toMatch(/<div data-section="pixel-perfect" data-state="gap">\s*<h4>Pixel perfect<\/h4>/);
  });

  it('leaves every section, and each role badge, a FILL marker', () => {
    const html = page(['kit', 'galaxy']);
    // flow, deploy and pixel perfect; per service: one functional section, three technical ones and a role badge
    expect(html.split(FILL)).toHaveLength(3 + 2 * (1 + 3 + 1) + 1);
  });

  it('writes the screens stylesheet once for the page, and the frames, the index and the 100 % view in the template', () => {
    const html = page(['kit', 'galaxy']);
    expect(html.match(/<template id="screen-css">/g)).toHaveLength(1);
    expect(html.match(/<nav class="index" aria-label="References" data-index hidden><\/nav>/g)).toHaveLength(1);
    for (const mark of ['attachShadow', ':host { all: initial; display: block; }', 'data-viewport', '100 %', '[data-tab="pixel-perfect"] { max-width: none; }', 'calc(var(--vw) * 0.5px)']) {
      expect(html, mark).toContain(mark);
    }
  });

  it('styles light and dark, the add, del and ctx lines, the badges and the no-change line, and loads nothing', () => {
    const html = page(['kit']);
    for (const mark of ['prefers-color-scheme: dark', '.add {', '.del {', '.ctx {', '.badge {', '.badge.breaking', '.badge.deploy', '.no-change']) {
      expect(html, mark).toContain(mark);
    }
    const filled = html.replaceAll(FILL, 'N/A');
    expect(grade(filled)).toEqual([]);
    expect(grade(asVersion2(filled))).toEqual([]);
  });

  it('passes the grading once each FILL is replaced, and fails today’s rules on the FILL markers left', () => {
    const filled = page(['kit', 'galaxy']).replaceAll(FILL, '<p>N/A — nothing changes</p>');
    expect(grade(filled)).toEqual([]);
    expect(grade(asVersion2(filled))).toEqual([]);
    expect(grade(asVersion2(page(['kit'])))).toEqual(['before-after.html: 8 <!-- FILL --> markers left']);
  });
});

describe('parseServices', () => {
  it('reads a comma list in order, trimming each name', () => {
    expect(parseServices('kit, galaxy,omni-app')).toEqual({ services: ['kit', 'galaxy', 'omni-app'] });
  });

  it('refuses a missing, empty or blank list', () => {
    for (const value of [undefined, '', ' , ,']) expect(parseServices(value)).toEqual({ refusal: '--services needs at least one service, as --services kit,app.' });
  });

  it('refuses a name the page cannot carry, and a name twice', () => {
    expect(parseServices('kit,"><script>')).toEqual({ refusal: '""><script>" is not a service name: use letters, digits, ".", "_" and "-".' });
    expect(parseServices('kit,galaxy,kit')).toEqual({ refusal: 'the service "kit" is named twice.' });
  });
});
