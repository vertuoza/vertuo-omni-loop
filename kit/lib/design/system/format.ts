// PRD 1559, s1: what `omni design parts` prints — one line per part with its variants, states and
// code paths, then a count with the file and its reference screens, then one line per thing in the
// file that does not read. With no file, the line that points at `/omni:pixel-perfect init`.
import type { LoadedSystem } from './load.ts';

const listed = (entries: readonly string[]): string => (entries.length ? entries.join(', ') : 'none');

export function formatParts({ path, system }: LoadedSystem): string[] {
  if (!system) return [`parts: no ${path} (run /omni:pixel-perfect init)`];
  const count = system.parts.length === 1 ? '1 part' : `${system.parts.length} parts`;
  return [
    ...system.parts.map((part) => `${part.name} — variants: ${listed(part.variants)} · states: ${listed(part.states)} · code: ${listed(part.code)}`),
    `${count} · ${path} · reference screens: ${listed(system.referenceScreens.map(({ screen }) => screen))}`,
    ...system.problems.map((problem) => `${path}: ${problem}`),
  ];
}
