// PRD 1559, s1: the repository's DESIGN.md read from where `design.system` points (by default
// `DESIGN.md` at the root). A file that is not there is reported as missing, never thrown.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { designSystemPath } from './path.ts';
import { parseDesignSystem, type DesignSystem } from './read.ts';

/** The path read, and the system it holds, or null when there is no file to read. */
export type LoadedSystem = { readonly path: string; readonly system: DesignSystem | null };

export function loadDesignSystem(root: string, design: { readonly system?: string | undefined }): LoadedSystem {
  const path = designSystemPath(design);
  let text: string;
  try {
    text = readFileSync(join(root, path), 'utf8');
  } catch {
    return { path, system: null };
  }
  return { path, system: parseDesignSystem(text) };
}
