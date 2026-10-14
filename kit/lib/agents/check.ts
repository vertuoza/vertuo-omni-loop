/**
 * **`omni check agents`** (PRD 1890, slice s5): the copies `.agents/skills/omni-*` against the
 * manifest that owns them. Red on an owned file whose sha-256 no longer matches (edited by hand) or
 * that is gone, and when `agents` lists an agent other than `claude` but no manifest exists (never
 * installed); each line says to run `omni update`. Green otherwise, and with `agents` `[claude]` and
 * no manifest. A file the manifest does not name is never graded: it is someone else's.
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { messageOf } from '../narrow.ts';
import { AGENTS_MANIFEST, AgentsError, readManifest, type AgentsManifest } from './write.ts';

/** What every red line of the check ends on. */
export const REWRITE_LINE = 'run omni update to rewrite the copies';

/** The agent served by the Claude plugin, not by the copies. */
const CLAUDE = 'claude';

/** The check's verdict: its red lines, and what it graded. */
export interface AgentsGrade {
  violations: string[];
  folders: number;
  files: number;
  installed: boolean;
}

const sha256 = (bytes: Buffer): string => createHash('sha256').update(bytes).digest('hex');

/** The red line of owned file `path` whose hash should be `hash`, or `null` when it matches. */
function fileViolation(root: string, path: string, hash: string): string | null {
  const file = join(root, path);
  if (!existsSync(file)) return `${path}: missing — ${REWRITE_LINE}`;
  if (sha256(readFileSync(file)) === hash) return null;
  return `${path}: edited by hand, it no longer matches ${AGENTS_MANIFEST} — ${REWRITE_LINE}`;
}

/** Every owned file of `manifest`, `[path, hash]`, in path order. */
function ownedFiles(manifest: AgentsManifest): [string, string][] {
  return Object.values(manifest.folders)
    .flatMap((files) => Object.entries(files))
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
}

/** Grades the copies of `root` against its manifest and the `agents` its config lists. */
export function gradeAgents({ root, agents }: { root: string; agents: readonly string[] }): AgentsGrade {
  let manifest: AgentsManifest | null;
  try {
    manifest = readManifest(root);
  } catch (error) {
    if (!(error instanceof AgentsError)) throw error;
    return { violations: [messageOf(error)], folders: 0, files: 0, installed: true };
  }
  if (manifest === null) {
    const others = agents.filter((agent) => agent !== CLAUDE);
    const violations =
      others.length === 0 ? [] : [`${AGENTS_MANIFEST}: missing, but agents lists ${others.join(', ')} — the skills were never installed for them; ${REWRITE_LINE}`];
    return { violations, folders: 0, files: 0, installed: false };
  }
  const files = ownedFiles(manifest);
  const violations = files.flatMap(([path, hash]) => fileViolation(root, path, hash) ?? []);
  return { violations, folders: Object.keys(manifest.folders).length, files: files.length, installed: true };
}
