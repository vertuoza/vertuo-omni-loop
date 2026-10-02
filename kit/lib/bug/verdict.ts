/**
 * **A bug fix can be proven** (PRD #556, slice s1).
 *
 * What `omni bug <n>` grades on a fix branch, as one function a test can hold open. A bug fix has no
 * PRD, spec or plan: its whole record is one folder `<paths.delivery>/bugs/<nnnn>-<slug>/` holding
 * `bug.md`, where `<nnnn>` is the issue number zero-padded to four digits. The checks, each failing
 * with one line a person can act on:
 *
 * 1. Exactly one such folder exists for the issue, and it holds `bug.md`.
 * 2. `bug.md` has the five sections — Triage, Reproduction, Fix, Guard, Mutation — none empty.
 * 3. Triage names a risk that is one of the four levels.
 * 4. Reproduction has a **File:** line naming a file that exists and that the branch changes, and a
 *    non-empty **Red:** line.
 * 5. Every commit of the branch carries the trailer `omni sign trailer` prints, unless the config
 *    says `signature: null`.
 *
 * It runs no test: the reproduction going green is CI's job.
 */
import { readFileSync, statSync } from 'node:fs';
import { isAbsolute, join, normalize } from 'node:path';
import { fixVerdict, issuePrefix, numberedFolders } from '../fix-verdict.ts';
import type { Commit } from '../fix-verdict.ts';
import type { TrailerSignature } from '../signature.ts';

/** What a bug verdict reads of the context: the root, where deliveries live and the signature. */
type BugContext = { root: string; config: { paths: { delivery: string }; signature: TrailerSignature | null } };

const RECORD = 'bug.md';

/** The sections a record holds, in order. */
export const SECTIONS: readonly string[] = ['Triage', 'Reproduction', 'Fix', 'Guard', 'Mutation'];

/** The risk levels a triage may name. */
export const RISK_LEVELS: readonly string[] = ['critical', 'high', 'medium', 'low'];

/** Where every bug fix's folder lives. */
export function bugRoot(ctx: { config: { paths: { delivery: string } } }): string {
  return `${ctx.config.paths.delivery}/bugs`;
}

/** The record's `## ` sections, as a map from heading to body text (first heading wins). */
export function parseSections(text: string): Map<string, string> {
  const sections = new Map<string, string[]>();
  let current: string | null = null;
  for (const line of text.split(/\r?\n/)) {
    const heading = /^##\s+(.+?)\s*#*\s*$/.exec(line);
    const name = heading?.[1];
    if (name !== undefined && !line.startsWith('###')) {
      current = sections.has(name) ? null : name;
      if (current !== null) sections.set(current, []);
    } else if (/^#\s/.test(line)) {
      current = null;
    } else if (current !== null) {
      sections.get(current)?.push(line);
    }
  }
  return new Map([...sections].map(([name, lines]) => [name, lines.join('\n').trim()]));
}

/** The value of a `- **<key>:** value` line in `body`: `undefined` with no such line, else trimmed. */
function field(body: string, key: string): string | undefined {
  const match = new RegExp(`^\\s*(?:[-*]\\s+)?\\*\\*${key}:\\*\\*(.*)$`, 'm').exec(body);
  return match ? (match[1] ?? '').trim() : undefined;
}

function isFile(ctx: { root: string }, path: string): boolean {
  try {
    return statSync(join(ctx.root, path)).isFile();
  } catch {
    return false;
  }
}

function triageViolations(record: string, body: string): string[] {
  const risk = field(body, 'Risk');
  if (risk === undefined || risk === '') return [`${record}: the Triage has no **Risk:** line.`];
  const level = (risk.split(/[\s—–-]/)[0] ?? '').replace(/[^a-z]/gi, '').toLowerCase();
  if (RISK_LEVELS.includes(level)) return [];
  return [`${record}: the Triage names risk "${risk.split(/\s/)[0]}"; it is one of critical, high, medium or low.`];
}

function reproductionViolations(ctx: { root: string }, record: string, body: string, changed: Set<string> | undefined): string[] {
  const violations: string[] = [];
  const file = field(body, 'File');
  if (file === undefined || file === '') {
    violations.push(`${record}: the Reproduction has no **File:** line naming the test or scenario.`);
  } else {
    const path = normalize(file.replace(/^`+|`+$/g, '').trim());
    if (isAbsolute(path) || path.startsWith('..') || !isFile(ctx, path)) {
      violations.push(`${record}: the reproduction ${path} does not exist.`);
    } else if (changed !== undefined && !changed.has(path)) {
      violations.push(`${record}: the reproduction ${path} is not changed on this branch.`);
    }
  }
  const red = field(body, 'Red');
  if (red === undefined) violations.push(`${record}: the Reproduction has no **Red:** line.`);
  else if (red === '') violations.push(`${record}: the Reproduction has an empty **Red:** line.`);
  return violations;
}

function recordViolations(ctx: { root: string }, record: string, changed: Set<string> | undefined): string[] {
  if (!isFile(ctx, record)) return [`${record}: missing.`];
  const sections = parseSections(readFileSync(join(ctx.root, record), 'utf8'));
  const violations: string[] = [];
  for (const name of SECTIONS) {
    if (!sections.has(name)) violations.push(`${record}: no "## ${name}" section.`);
    else if (sections.get(name) === '') violations.push(`${record}: the "## ${name}" section is empty.`);
  }
  const triage = sections.get('Triage');
  if (triage) violations.push(...triageViolations(record, triage));
  const reproduction = sections.get('Reproduction');
  if (reproduction) violations.push(...reproductionViolations(ctx, record, reproduction, changed));
  return violations;
}

/**
 * Grades one issue's bug fix on the working tree, the branch's changed files and its commits when
 * given.
 */
export function bugVerdict({ ctx, issue, changed, commits }: {
  ctx: BugContext;
  issue: number;
  changed?: Iterable<string>;
  commits?: readonly Commit[];
}): { ok: boolean; folder: string | null; failures: string[] } {
  const changedSet = changed === undefined ? undefined : new Set([...changed].map((path) => normalize(path)));
  return fixVerdict({
    ctx, issue, commits, root: bugRoot(ctx), prefix: issuePrefix(issue), folders: numberedFolders(ctx, bugRoot(ctx), issuePrefix(issue)),
    grade: (folder) => recordViolations(ctx, `${folder}/${RECORD}`, changedSet),
  });
}
