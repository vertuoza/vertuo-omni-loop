// The part register: reads the parts of ../src (each `X.tsx` beside its `X.css`, `X.meta.ts` and
// `X.specimen.tsx`) and writes ../src/generated/: `parts.ts`, the package's exports, and
// `catalogue.ts`, every part's component, meta and specimen for the tests and the `/design`
// catalogue. A slice adds a part's four files and runs `pnpm --filter @omni/ui parts`; no list is
// edited by hand, so two slices adding parts never touch the same file. parts.test.ts fails while
// a committed output differs from what the files present generate.
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';

const SRC = new URL('../src/', import.meta.url);
/** A part's component file: a PascalCase name, `.tsx`, and nothing between. */
const COMPONENT = /^([A-Z][A-Za-z0-9]*)\.tsx$/;
/** The files every part has beside its component. */
const SIDES = ['css', 'meta.ts', 'specimen.tsx'] as const;

/** A part as the register writes it: its name and the names its meta and specimen export. */
export interface PartFiles {
  readonly name: string;
  readonly meta: string;
  readonly specimen: string;
}

/** `EmptyState` → `emptyState`: the stem of a part's meta and specimen exports. */
export function camel(name: string): string {
  return name.charAt(0).toLowerCase() + name.slice(1);
}

/**
 * The parts among `files` (the names of ../src), sorted, each checked: its three side files present,
 * its meta exporting `<camel>Meta` and its specimen `<camel>Specimen`. `read` gives a file's text.
 */
export function partsOf(files: readonly string[], read: (file: string) => string): PartFiles[] {
  const present = new Set(files);
  const names = files.flatMap((file) => COMPONENT.exec(file)?.[1] ?? []).sort();
  return names.map((name) => {
    for (const side of SIDES) {
      if (!present.has(`${name}.${side}`)) throw new Error(`${name}: ${name}.${side} is missing; a part is X.tsx, X.css, X.meta.ts and X.specimen.tsx`);
    }
    const meta = `${camel(name)}Meta`, specimen = `${camel(name)}Specimen`;
    if (!new RegExp(`export const ${meta}\\b`).test(read(`${name}.meta.ts`))) throw new Error(`${name}.meta.ts exports no ${meta}`);
    if (!new RegExp(`export (const|function) ${specimen}\\b`).test(read(`${name}.specimen.tsx`))) throw new Error(`${name}.specimen.tsx exports no ${specimen}`);
    return { name, meta, specimen };
  });
}

const HEAD = [
  '// Generated from the parts of packages/ui/src by packages/ui/build/parts.ts: do not edit. Add a',
  '// part\'s X.tsx, X.css, X.meta.ts and X.specimen.tsx there and run `pnpm --filter @omni/ui parts`.',
];

/** src/generated/parts.ts: every part's component and props, as the package exports them. */
export function partsModule(parts: readonly PartFiles[]): string {
  return [...HEAD, '', ...parts.map(({ name }) => `export * from '../${name}.tsx';`), ''].join('\n');
}

/** src/generated/catalogue.ts: every part's component, meta and specimen, in name order. */
export function catalogueModule(parts: readonly PartFiles[]): string {
  return [
    ...HEAD,
    '',
    'import type { Part } from \'../meta.ts\';',
    ...parts.flatMap(({ name, meta, specimen }) => [
      `import { ${name} } from '../${name}.tsx';`,
      `import { ${meta} } from '../${name}.meta.ts';`,
      `import { ${specimen} } from '../${name}.specimen.tsx';`,
    ]),
    '',
    '/** Every part\'s component, by its name. */',
    `export const COMPONENTS = { ${parts.map(({ name }) => name).join(', ')} } as const;`,
    '',
    '/** Every part: its meta (variants, usage, do, don\'t, contrast) and its specimen. */',
    'export const PARTS: readonly Part[] = [',
    ...parts.map(({ meta, specimen }) => `  { meta: ${meta}, specimen: ${specimen} },`),
    '];',
    '',
  ].join('\n');
}

/** The generated files, by their name under src/generated/, for the parts of `src`. */
export function generatedFiles(src: URL = SRC): Record<string, string> {
  const parts = partsOf(readdirSync(src), (file) => readFileSync(new URL(file, src), 'utf8'));
  return { 'parts.ts': partsModule(parts), 'catalogue.ts': catalogueModule(parts) };
}

/** Writes src/generated/ from the parts of `src`. */
export function writeParts(src: URL = SRC): void {
  const out = new URL('generated/', src);
  mkdirSync(out, { recursive: true });
  for (const [name, text] of Object.entries(generatedFiles(src))) writeFileSync(new URL(name, out), text);
}
