// The design manifest: reads the DTCG tokens of @omni/design, each part's `X.meta.ts` and the locked
// screens of the screen library, and writes ../../design/design-system.json, the one short, exact list
// of what an agent may build a screen from (PRD omni-loop-13). It lives beside the part register
// because @omni/ui depends on @omni/design, never the other way. A part added later is in it with no
// edit here: the parts are the ones parts.ts registers. manifest.test.ts fails while a committed
// file differs from a fresh build; the file is generated (`generated:` in .omni-loop/config.yml), so
// it is rebuilt with `node packages/ui/build/manifest.ts` (or `pnpm --filter @omni/ui manifest`).
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { SCALE, THEME_ROLES } from '@omni/design';
import { partsOf } from './parts.ts';

const SRC = new URL('../src/', import.meta.url);
const SCREENS = new URL('../../../.omni-loop/knowledge/design/screens/', import.meta.url);
const OUT = new URL('../../design/design-system.json', import.meta.url);
const THEMES = ['omni', 'light', 'dark'] as const;
type Theme = (typeof THEMES)[number];

/** The manifest's version: a reader refuses any other. */
export const MANIFEST_VERSION = 1;

/** The parts of a component's `meta.ts` the manifest keeps. */
export interface ComponentSource {
  readonly name: string;
  readonly variants: Readonly<Record<string, readonly string[]>>;
  readonly usage: string;
  readonly do: readonly string[];
  readonly dont: readonly string[];
  readonly replaces: readonly string[];
  readonly example: string;
}

/** A locked screen of the library, as its front matter says it. */
export interface PatternSource {
  readonly name: string;
  readonly routes: readonly string[];
  readonly mock: string;
}

/** Where the component rule applies: the app pages, the arcade `/play` and HOME `/` left out. */
export const SURFACES = {
  include: ['apps/galaxy/app/**', 'apps/galaxy/src/**'],
  exclude: [
    'apps/galaxy/app/page.tsx',
    'apps/galaxy/app/play/**',
    'apps/galaxy/src/arcade/**',
    'apps/galaxy/src/arcade-api/**',
    'apps/galaxy/src/home/**',
    'apps/galaxy/src/play-dock/**',
  ],
} as const;

interface Token {
  readonly name: string;
  readonly group: string;
  readonly role: string;
  readonly themes: Readonly<Record<Theme, string>>;
}

/** Every token: each colour role (its value differs per theme) and each scale token (the same in all three). */
export function tokensOf(
  roles: Readonly<Record<Theme, Readonly<Record<string, string>>>> = THEME_ROLES,
  scale: Readonly<Record<string, string>> = SCALE,
): Token[] {
  const colours = Object.keys(roles.omni).map((role): Token => ({
    name: `color-${role}`,
    group: 'color',
    role,
    themes: { omni: roles.omni[role] ?? '', light: roles.light[role] ?? '', dark: roles.dark[role] ?? '' },
  }));
  const scaled = Object.entries(scale).map(([name, value]): Token => ({
    name,
    group: name.split('-')[0] ?? name,
    role: name.split('-')[0] ?? name,
    themes: { omni: value, light: value, dark: value },
  }));
  return [...colours, ...scaled];
}

/** A list in front matter: `[a, b]`, or a lone value. */
function list(value: string): string[] {
  const inner = value.startsWith('[') && value.endsWith(']') ? value.slice(1, -1) : value;
  return inner.split(',').map((part) => part.trim()).filter((part) => part !== '');
}

/** The locked screens among the library's files, by library name; none is locked today. */
export function patternsOf(files: Readonly<Record<string, string>>): PatternSource[] {
  return Object.entries(files)
    .filter(([file]) => file.endsWith('.md'))
    .flatMap(([, text]): PatternSource[] => {
      const head = /^---\n([\s\S]*?)\n---/.exec(text)?.[1];
      if (head === undefined) return [];
      const fields = Object.fromEntries(head.split('\n').flatMap((line) => {
        const at = line.indexOf(':');
        return at < 1 ? [] : [[line.slice(0, at).trim(), line.slice(at + 1).trim()] as const];
      }));
      if (fields.status !== 'locked' || fields.screen === undefined) return [];
      return [{ name: fields.screen, routes: list(fields.routes ?? ''), mock: fields.mock ?? '' }];
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** A value with every object's keys sorted, so the file is stable; arrays keep their order. */
function sorted(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sorted);
  if (typeof value !== 'object' || value === null) return value;
  return Object.fromEntries(Object.entries(value).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)).map(([key, v]) => [key, sorted(v)]));
}

/** The manifest's text for these sources: keys sorted, two-space indent, a trailing newline. */
export function manifestText(components: readonly ComponentSource[], tokens: readonly Token[], patterns: readonly PatternSource[]): string {
  const manifest = {
    'omni-design': MANIFEST_VERSION,
    tokens,
    components: components.map(({ name, variants, usage, do: dos, dont, replaces, example }) => (
      { name, import: '@omni/ui', variants, usage, do: dos, dont, replaces, example }
    )),
    patterns,
    surfaces: SURFACES,
  };
  return `${JSON.stringify(sorted(manifest), null, 2)}\n`;
}

/** The components, in name order: the meta of each part the register lists. */
async function componentsOf(src: URL): Promise<ComponentSource[]> {
  const files = readdirSync(src);
  const parts = partsOf(files, (file) => readFileSync(new URL(file, src), 'utf8'));
  return Promise.all(parts.map(async ({ name, meta }) => {
    const module: Record<string, unknown> = await import(new URL(`${name}.meta.ts`, src).href);
    return module[meta] as ComponentSource;
  }));
}

/** The manifest of this repository, as it should be committed. */
export async function buildManifest(src: URL = SRC, screens: URL = SCREENS): Promise<string> {
  const library = Object.fromEntries(readdirSync(screens).filter((f) => f.endsWith('.md')).map((f) => [f, readFileSync(new URL(f, screens), 'utf8')]));
  return manifestText(await componentsOf(src), tokensOf(), patternsOf(library));
}

/** Writes packages/design/design-system.json. */
export async function writeManifest(): Promise<void> {
  writeFileSync(OUT, await buildManifest());
}

// Run as `node packages/ui/build/manifest.ts` (the config's `generated` build) or `pnpm --filter @omni/ui manifest`.
if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) await writeManifest();
