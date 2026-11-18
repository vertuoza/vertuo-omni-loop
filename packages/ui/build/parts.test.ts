// The part register: every part present is listed, a part missing a file is refused, and the
// committed src/generated/ is what the parts present generate.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { camel, catalogueModule, generatedFiles, partsModule, partsOf } from './parts.ts';

const files = (names: readonly string[]) => names.flatMap((n) => [`${n}.tsx`, `${n}.css`, `${n}.meta.ts`, `${n}.specimen.tsx`]);
const reader = (overrides: Readonly<Record<string, string>> = {}) => (file: string): string => {
  if (file in overrides) return overrides[file] ?? '';
  const name = file.split('.')[0] ?? '';
  return file.endsWith('.meta.ts') ? `export const ${camel(name)}Meta = {};` : `export const ${camel(name)}Specimen = () => null;`;
};

describe('the part register', () => {
  it('lists every part present, in name order, and nothing else', () => {
    const parts = partsOf([...files(['Tabs', 'EmptyState', 'Badge']), 'meta.ts', 'css.d.ts', 'ui.test.ts', 'index.ts'], reader());
    expect(parts).toEqual([
      { name: 'Badge', meta: 'badgeMeta', specimen: 'badgeSpecimen' },
      { name: 'EmptyState', meta: 'emptyStateMeta', specimen: 'emptyStateSpecimen' },
      { name: 'Tabs', meta: 'tabsMeta', specimen: 'tabsSpecimen' },
    ]);
  });

  it('refuses a part missing its stylesheet, its meta or its specimen', () => {
    for (const side of ['css', 'meta.ts', 'specimen.tsx']) {
      const present = files(['Badge']).filter((file) => file !== `Badge.${side}`);
      expect(() => partsOf(present, reader()), side).toThrow(`Badge.${side} is missing`);
    }
  });

  it('refuses a meta or a specimen that does not export the name the register imports', () => {
    expect(() => partsOf(files(['Badge']), reader({ 'Badge.meta.ts': 'export const meta = {};' }))).toThrow('Badge.meta.ts exports no badgeMeta');
    expect(() => partsOf(files(['Badge']), reader({ 'Badge.specimen.tsx': 'export const specimen = 1;' }))).toThrow('exports no badgeSpecimen');
  });

  it('exports every part, and lists each one\'s component, meta and specimen for the catalogue', () => {
    const parts = partsOf(files(['Badge', 'Card']), reader());
    expect(partsModule(parts)).toContain("export * from '../Badge.tsx';\nexport * from '../Card.tsx';\n");
    const catalogue = catalogueModule(parts);
    expect(catalogue).toContain("import { cardSpecimen } from '../Card.specimen.tsx';");
    expect(catalogue).toContain('export const COMPONENTS = { Badge, Card } as const;');
    expect(catalogue).toContain('  { meta: badgeMeta, specimen: badgeSpecimen },\n  { meta: cardMeta, specimen: cardSpecimen },\n];');
  });

  it('is what src/generated/ holds: run `pnpm --filter @omni/ui parts` after adding a part', () => {
    for (const [name, text] of Object.entries(generatedFiles())) {
      expect(readFileSync(new URL(`../src/generated/${name}`, import.meta.url), 'utf8'), name).toBe(text);
    }
  });
});
