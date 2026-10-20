// PRD 2239, s2: the before/after skeleton and the services list, pure; the page it writes passes s1's grading.
import { describe, expect, it } from 'vitest';
import { kitTemplate } from '../playbook/templates.ts';
import { parsePrd } from '../ids.ts';
import { gradeBeforeAfter } from './grade.ts';
import { beforeAfterSkeleton, parseServices } from './skeleton.ts';

const page = (services: string[]) => beforeAfterSkeleton({ template: kitTemplate('before-after/page.html'), prd: 2239, services });
const FILL = '<!-- FILL -->';

describe('beforeAfterSkeleton', () => {
  it('carries the meta, both tabs in order with the first checked, and the hash script', () => {
    const html = page(['kit']);
    expect(html).toContain('<meta name="omni-before-after" content="2">');
    expect(html.indexOf('data-tab="functional"')).toBeGreaterThan(0);
    expect(html.indexOf('data-tab="technical"')).toBeGreaterThan(html.indexOf('data-tab="functional"'));
    expect(html).toMatch(/id="tab-functional" class="tab-input" checked>\s*<input type="radio" name="tab" id="tab-technical" class="tab-input">/);
    expect(html).toContain("location.hash === '#technical'");
    expect(html).toContain('PRD 2239');
    expect(html).not.toContain('{{');
  });

  it('holds one data-service block per service in each tab, in the order named', () => {
    const html = page(['kit', 'galaxy']);
    const [functional = '', technical = ''] = html.split('<section data-tab="technical">');
    for (const part of [functional, technical]) {
      expect(part.match(/data-service="/g)).toHaveLength(2);
      expect(part.indexOf('data-service="kit"')).toBeLessThan(part.indexOf('data-service="galaxy"'));
    }
    expect(functional.match(/data-section="(functional|pixel-perfect)"/g)).toHaveLength(4);
    expect(technical.match(/data-section="(db|api|behaviour)"/g)).toHaveLength(6);
    expect(technical).toContain('data-section="flow"');
    expect(technical).toContain('data-section="deploy"');
  });

  it('leaves every section, and each role badge, a FILL marker', () => {
    const html = page(['kit', 'galaxy']);
    // flow and deploy; per service: two functional sections, three technical ones and a role badge
    expect(html.split(FILL)).toHaveLength(2 + 2 * (2 + 3 + 1) + 1);
  });

  it('styles light and dark, the add, del and ctx lines, the badges and the no-change line, and loads nothing', () => {
    const html = page(['kit']);
    for (const mark of ['prefers-color-scheme: dark', '.add {', '.del {', '.ctx {', '.badge {', '.badge.breaking', '.badge.deploy', '.no-change']) {
      expect(html, mark).toContain(mark);
    }
    expect(gradeBeforeAfter({ file: 'before-after.html', html: page(['kit']).replaceAll(FILL, 'N/A'), prd: parsePrd(2239) })).toEqual([]);
  });

  it('passes the grading once each FILL is replaced, and fails it on the FILL markers left', () => {
    const filled = page(['kit', 'galaxy']).replaceAll(FILL, '<p>N/A — nothing changes</p>');
    expect(gradeBeforeAfter({ file: 'before-after.html', html: filled, prd: parsePrd(2239) })).toEqual([]);
    const left = gradeBeforeAfter({ file: 'before-after.html', html: page(['kit']), prd: parsePrd(2239) });
    expect(left).toEqual(['before-after.html: 8 <!-- FILL --> markers left']);
  });
});

describe('parseServices', () => {
  it('reads a comma list in order, trimming each name', () => {
    expect(parseServices('kit, galaxy,omni-app')).toEqual({ services: ['kit', 'galaxy', 'omni-app'] });
  });

  it('refuses a missing, empty or blank list', () => {
    for (const value of [undefined, '', ' , ,']) expect(parseServices(value)).toEqual({ refusal: '--services needs at least one service, as --services kit,galaxy.' });
  });

  it('refuses a name the page cannot carry, and a name twice', () => {
    expect(parseServices('kit,"><script>')).toEqual({ refusal: '"><script>" is not a service name: use letters, digits, ".", "_" and "-".' });
    expect(parseServices('kit,galaxy,kit')).toEqual({ refusal: 'the service "kit" is named twice.' });
  });
});
