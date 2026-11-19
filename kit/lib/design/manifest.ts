// The design manifest (PRD omni-loop-13): the generated file `design.manifest` names, read and
// validated here, then printed as `omni design components` (the index) and `omni design component
// <name>` (one card). A repository with no `design.manifest` has no manifest and nothing changes:
// the commands say so in one line. The file is version 1 (`"omni-design": 1`).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';
import { messageOf } from '../narrow.ts';

const text = z.string().min(1);
const themes = z.object({ omni: text, light: text, dark: text }).strict();

const component = z.object({
  name: text,
  import: text,
  variants: z.record(z.string(), z.array(z.string())).default({}),
  usage: z.string().optional(),
  do: z.array(z.string()).default([]),
  dont: z.array(z.string()).default([]),
  replaces: z.array(z.string()).default([]),
  example: text,
});

const token = z.object({ name: text, role: text, group: z.string().optional(), themes });

const pattern = z.object({ name: text, routes: z.array(z.string()).default([]), mock: z.string().default('') });

/** The globs where the component rule applies: the generator writes `{ include, exclude }`; a plain list is read as the includes. */
const surfaces = z
  .union([z.array(z.string()), z.object({ include: z.array(z.string()).default([]), exclude: z.array(z.string()).default([]) })])
  .default([]);

/** The manifest, version 1. Fields a later slice reads (patterns, surfaces) are checked loosely. */
const manifestSchema = z.object({
  'omni-design': z.literal(1),
  tokens: z.array(token).default([]),
  components: z.array(component).default([]),
  patterns: z.array(pattern).default([]),
  surfaces,
});

export type DesignManifest = z.infer<typeof manifestSchema>;


export type ManifestRead = { kind: 'none' } | { kind: 'ok'; manifest: DesignManifest } | { kind: 'refused'; refusals: string[] };

/** The line printed when the repository names no manifest. */
export const NO_MANIFEST = 'this repository has no design manifest (design.manifest is not set)';

/** One line per refusal, naming the field. */
function refusals(error: z.ZodError): string[] {
  return error.issues.map((issue) => `${issue.path.length === 0 ? 'manifest' : issue.path.join('.')}: ${issue.message}`);
}

/** Validates a parsed manifest. */
export function parseManifest(value: unknown): ManifestRead {
  const parsed = manifestSchema.safeParse(value);
  return parsed.success ? { kind: 'ok', manifest: parsed.data } : { kind: 'refused', refusals: refusals(parsed.error) };
}

/** Reads the file `manifest` (relative to `root`) names, or says there is none. */
export function readManifest(root: string, manifest: string | null | undefined): ManifestRead {
  if (!manifest) return { kind: 'none' };
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(join(root, manifest), 'utf8'));
  } catch (error) {
    return { kind: 'refused', refusals: [`${manifest}: cannot read — ${messageOf(error).split('\n')[0]}`] };
  }
  return parseManifest(raw);
}

/** The components index: one line per component, its name and its import. */
export function formatComponents(manifest: DesignManifest): string[] {
  return manifest.components.map((c) => `${c.name}  ${c.import}`);
}

/** The most bytes a component card prints. */
const CARD_CAP = 800;

/** Edit distance, for the closest names. */
function distance(a: string, b: string): number {
  let row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const next = [i];
    for (let j = 1; j <= b.length; j++) next.push(Math.min((next[j - 1] ?? 0) + 1, (row[j] ?? 0) + 1, (row[j - 1] ?? 0) + (a[i - 1] === b[j - 1] ? 0 : 1)));
    row = next;
  }
  return row[b.length] ?? 0;
}

/** The names closest to `name`, at most three. */
export function closestNames(manifest: DesignManifest, name: string): string[] {
  const want = name.toLowerCase();
  return manifest.components
    .map((c) => ({ name: c.name, score: c.name.toLowerCase().includes(want) || want.includes(c.name.toLowerCase()) ? 0 : distance(c.name.toLowerCase(), want) }))
    .sort((x, y) => x.score - y.score || x.name.localeCompare(y.name))
    .slice(0, 3)
    .map((c) => c.name);
}

const size = (lines: readonly string[]): number => lines.reduce((n, line) => n + Buffer.byteLength(line) + 1, 0);

/** The leading lines that fit within `cap` bytes (each counts its newline). */
function within(lines: readonly string[], cap: number): string[] {
  const kept: string[] = [];
  for (const line of lines) {
    if (size(kept) + Buffer.byteLength(line) + 1 > cap) break;
    kept.push(line);
  }
  return kept;
}

/** One component's card: its variants, do and don't, and one example, within `CARD_CAP` bytes; null for an unknown name. */
export function formatComponent(manifest: DesignManifest, name: string): string[] | null {
  const c = manifest.components.find((item) => item.name === name) ?? manifest.components.find((item) => item.name.toLowerCase() === name.toLowerCase());
  if (!c) return null;
  const variants = Object.entries(c.variants).map(([prop, values]) => `  ${prop}: ${values.join(' | ')}`);
  const head = [
    `${c.name}  ${c.import}`,
    ...(variants.length > 0 ? ['variants:', ...variants] : []),
    ...(c.do.length > 0 ? ['do:', ...c.do.map((line) => `  ${line}`)] : []),
    ...(c.dont.length > 0 ? ["don't:", ...c.dont.map((line) => `  ${line}`)] : []),
  ];
  // The example is what an agent needs most: it is kept, and the cap cuts the lines before it.
  const tail = ['example:', `  ${c.example}`];
  return [...within(head, CARD_CAP - size(tail)), ...tail];
}

const groupOf = (t: DesignManifest['tokens'][number]): string => t.group ?? t.role;

/** The token groups and their counts, one line each. */
export function formatTokenGroups(manifest: DesignManifest): string[] {
  const counts = new Map<string, number>();
  for (const t of manifest.tokens) counts.set(groupOf(t), (counts.get(groupOf(t)) ?? 0) + 1);
  return [...counts].map(([group, n]) => `${group}  ${n}`);
}

/** The token group names, in order. */
export function tokenGroupNames(manifest: DesignManifest): string[] {
  return [...new Set(manifest.tokens.map(groupOf))];
}

/** One group's tokens with their value in each theme; null for an unknown group. */
export function formatTokens(manifest: DesignManifest, group: string): string[] | null {
  const hit = manifest.tokens.filter((t) => groupOf(t) === group);
  if (hit.length === 0) return null;
  return hit.map((t) => `${t.name}  omni ${t.themes.omni}  light ${t.themes.light}  dark ${t.themes.dark}`);
}

/** A locked screen's card: its routes and its mockup, within `CARD_CAP` bytes; null for an unknown name. */
export function formatPattern(manifest: DesignManifest, name: string): string[] | null {
  const p = manifest.patterns.find((item) => item.name === name) ?? manifest.patterns.find((item) => item.name.toLowerCase() === name.toLowerCase());
  if (!p) return null;
  return within([p.name, `routes: ${p.routes.join(', ')}`, `mockup: ${p.mock}`], CARD_CAP);
}

/** The locked screens' names. */
export function patternNames(manifest: DesignManifest): string[] {
  return manifest.patterns.map((p) => p.name);
}
