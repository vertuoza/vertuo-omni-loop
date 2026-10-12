// A product's links from a config (PRD 1364, s5): plan.targets as the links to import, consumes as
// whole slugs, and the lines `omni product import` and `omni product which` print of the replies.
import { describe, expect, it } from 'vitest';
import { importLines, linksOfTargets, ProductImportRequestSchema, whichLines } from './import.ts';

const SHA = '3f2a9c1e0b7d4c5a8e6f1d2c3b4a5968778695a4';
const TARGETS = [
  { repo: 'acme/api', role: 'api', knowledge: 'imported' as const, readAt: SHA, readOnly: false, consumes: [] },
  { repo: 'acme/app', role: 'mobile', knowledge: 'own' as const, readAt: null, readOnly: false, consumes: ['api', 'docs'] },
  { repo: 'beta/docs', role: 'docs', knowledge: 'none' as const, readAt: null, readOnly: true, consumes: [] },
];

describe('linksOfTargets', () => {
  it('sends each target as a link, in config order, consumes as the slugs of the targets they name', () => {
    expect(linksOfTargets(TARGETS)).toEqual([
      TARGETS[0],
      { ...TARGETS[1], consumes: ['acme/api', 'beta/docs'] },
      TARGETS[2],
    ]);
    expect(ProductImportRequestSchema.safeParse({ repo: 'acme/plan', product: 'Mobile', targets: linksOfTargets(TARGETS) }).success).toBe(true);
  });
});

describe('importLines', () => {
  it('says what was added and changed, one repository a line', () => {
    expect(importLines({ product: { name: 'Mobile' }, added: ['acme/api', 'acme/app'], changed: ['beta/docs'], unchanged: [] }, 'mobile')).toEqual([
      'product Mobile: 2 added, 1 changed, 0 unchanged',
      '  added    acme/api',
      '  added    acme/app',
      '  changed  beta/docs',
    ]);
  });

  it('says nothing changed when every link was already as the config says', () => {
    expect(importLines({ product: { name: 'Mobile' }, added: [], changed: [], unchanged: ['acme/api', 'acme/app'] }, 'Mobile')).toEqual([
      'product Mobile: nothing changed, 2 links already as plan.targets says',
    ]);
    expect(importLines({ product: { name: 'Mobile' }, added: [], changed: [], unchanged: ['acme/api'] }, 'Mobile')).toEqual([
      'product Mobile: nothing changed, 1 link already as plan.targets says',
    ]);
  });

  it('refuses a reply of another shape, naming the product', () => {
    expect(() => importLines({ product: { name: 'Mobile' } }, 'Mobile')).toThrow('the server answered no import for product Mobile');
  });
});

describe('whichLines', () => {
  it('prints one product a line, or none', () => {
    expect(whichLines({ products: [{ name: 'Estimates' }, { name: 'Mobile' }] })).toEqual(['Estimates', 'Mobile']);
    expect(whichLines({ products: [] })).toEqual(['none']);
  });

  it('refuses a reply of another shape', () => {
    expect(() => whichLines({ products: [{}] })).toThrow('the server answered no products for this repository');
  });
});
