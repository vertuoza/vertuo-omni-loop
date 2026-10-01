// @ts-nocheck
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
import { fixVerdict, numberedFolders } from '../fix-verdict.ts';

const RECORD = 'bug.md';

/** The sections a record holds, in order. */
export const SECTIONS = ['Triage', 'Reproduction', 'Fix', 'Guard', 'Mutation'];

/** The risk levels a triage may name. */
export const RISK_LEVELS = ['critical', 'high', 'medium', 'low'];

/** Where every bug fix's folder lives. */
export function bugRoot(ctx) {
  return `${ctx.config.paths.delivery}/bugs`;
}

/** The folder name prefix of an issue's bug fix: its number, zero-padded to four digits, then `-`. */
export function folderPrefix(issue) {
  return `${String(issue).padStart(4, '0')}-`;
}

/** The record's `## ` sections, as a map from heading to body text (first heading wins). */
export function parseSections(text) {
  const sections = new Map();
  let current = null;
  for (const line of text.split(/\r?\n/)) {
    const heading = /^##\s+(.+?)\s*#*\s*$/.exec(line);
    if (heading && !line.startsWith('###')) {
      current = sections.has(heading[1]) ? null : heading[1];
      if (current !== null) sections.set(current, []);
    } else if (/^#\s/.test(line)) {
      current = null;
    } else if (current !== null) {
      sections.get(current).push(line);
    }
  }
  return new Map([...sections].map(([name, lines]) => [name, lines.join('\n').trim()]));
}

/** The value of a `- **<key>:** value` line in `body`: `undefined` with no such line, else trimmed. */
function field(body, key) {
  const match = new RegExp(`^\\s*(?:[-*]\\s+)?\\*\\*${key}:\\*\\*(.*)$`, 'm').exec(body);
  return match ? match[1].trim() : undefined;
}

function isFile(ctx, path) {
  try {
    return statSync(join(ctx.root, path)).isFile();
  } catch {
    return false;
  }
}

function triageViolations(record, body) {
  const risk = field(body, 'Risk');
  if (risk === undefined || risk === '') return [`${record}: the Triage has no **Risk:** line.`];
  const level = risk.split(/[\s—–-]/)[0].replace(/[^a-z]/gi, '').toLowerCase();
  if (RISK_LEVELS.includes(level)) return [];
  return [`${record}: the Triage names risk "${risk.split(/\s/)[0]}"; it is one of critical, high, medium or low.`];
}

function reproductionViolations(ctx, record, body, changed) {
  const violations = [];
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

function recordViolations(ctx, record, changed) {
  if (!isFile(ctx, record)) return [`${record}: missing.`];
  const sections = parseSections(readFileSync(join(ctx.root, record), 'utf8'));
  const violations = [];
  for (const name of SECTIONS) {
    if (!sections.has(name)) violations.push(`${record}: no "## ${name}" section.`);
    else if (sections.get(name) === '') violations.push(`${record}: the "## ${name}" section is empty.`);
  }
  if (sections.get('Triage')) violations.push(...triageViolations(record, sections.get('Triage')));
  if (sections.get('Reproduction')) {
    violations.push(...reproductionViolations(ctx, record, sections.get('Reproduction'), changed));
  }
  return violations;
}

/**
 * Grades one issue's bug fix on the working tree, the branch's changed files and its commits when
 * given.
 *
 * @param {{ ctx: object, issue: number, changed?: Iterable<string>,
 *   commits?: { sha: string, message: string }[] }} options
 * @returns {{ ok: boolean, folder: string | null, failures: string[] }}
 */
export function bugVerdict({ ctx, issue, changed, commits }) {
  const changedSet = changed === undefined ? undefined : new Set([...changed].map((path) => normalize(path)));
  return fixVerdict({
    ctx, issue, commits, root: bugRoot(ctx), prefix: folderPrefix(issue), folders: numberedFolders(ctx, bugRoot(ctx), folderPrefix(issue)),
    grade: (folder) => recordViolations(ctx, `${folder}/${RECORD}`, changedSet),
  });
}
