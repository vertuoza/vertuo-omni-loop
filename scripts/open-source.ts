#!/usr/bin/env node
// node scripts/open-source.ts — the code base is safe to be open source (PRD 2305; never#11 and
// never#12 of the constituents). Every file git tracks is read, the generated bundles and the
// lockfile excepted, with three generic rules, so no internal name is listed here:
//
// - internal repository: the maintainer's GitHub organisation followed by a repository other than
//   this one, or a name carrying the prefix the maintainer's repositories share, other than this
//   repository's own name and its Vercel host;
// - real email: an address on the maintainer's domain;
// - secret: a GitHub token, an `sk-` API key, a private-key block, a Supabase secret key, an AWS
//   access key, a JWT other than the jwt.io sample, a Postgres URL whose password is not the local
//   stack's default. A visible fake is listed in scripts/open-source.allow.json: its file, a pattern
//   its value matches, and the reason it is no secret.
//
// A finding prints `<file>:<line>: <rule> — <what to use instead>`, never the value it found, and
// the guard exits 1. Clean, it prints one line and exits 0. There is no baseline: every file passes
// the internal-delivery rules as written. The pre-push hook and the `security` workflow run it.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

/** The maintainer's public identity, and this repository's own names, which every rule lets through. */
const MAINTAINER = {
  organisation: 'vertuoza',
  repositoryPrefix: 'vertuo',
  domain: 'vertuoza.com',
};
const OWN_REPOSITORY = 'vertuo-omni-loop';
const OWN_NAMES: ReadonlySet<string> = new Set([OWN_REPOSITORY, `${OWN_REPOSITORY}-galaxy`]);

/** Paths never read: the bundles built from the sources read here, and the lockfile's hashes. */
const SKIPPED = [/^kit\/dist\//, /^apps\/omni-app\/api\//, /^pnpm-lock\.yaml$/];

const ALLOW_FILE = 'scripts/open-source.allow.json';

export interface SourceFile {
  path: string;
  text: string;
}

export interface AllowEntry {
  file: string;
  pattern: string;
  reason: string;
}

export interface Finding {
  path: string;
  line: number;
  rule: string;
  fix: string;
}

export interface Verdict {
  findings: Finding[];
  /** One line per problem with the allowlist itself. */
  problems: string[];
}

const SECRET_FIX = `build the fake at runtime, or list it in ${ALLOW_FILE} with its reason; a real one is rotated`;

const lineAt = (text: string, index: number): number => text.slice(0, index).split('\n').length;
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

/** The JWT's claims, or null when its middle part is not base64url JSON. */
function claims(token: string): Record<string, unknown> | null {
  try {
    const parsed: unknown = JSON.parse(Buffer.from(token.split('.')[1] ?? '', 'base64url').toString('utf8'));
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/** A Postgres password that only stands for one: a placeholder or a variable, not a value. */
const placeholder = (password: string): boolean => /^[<[{$*%]|^(\.\.\.|…)$|^password$/i.test(password);

interface SecretShape {
  name: string;
  pattern: RegExp;
  /** A match that is no secret after all (the jwt.io sample, the local stack's password). */
  harmless?: (match: RegExpMatchArray) => boolean;
}

const SECRETS: readonly SecretShape[] = [
  { name: 'GitHub token', pattern: /(?<![A-Za-z0-9_])(?:gh[pousr]_[A-Za-z0-9_]{16,}|github_pat_[A-Za-z0-9_]{16,})/g },
  { name: 'API key', pattern: /(?<![A-Za-z0-9_-])sk-[A-Za-z0-9_-]{20,}/g },
  { name: 'private key', pattern: /-----BEGIN (?:[A-Z0-9]+ )*PRIVATE KEY-----(?:\r?\n|(?:\\)+n)[ \t]*[A-Za-z0-9+/=]/g },
  { name: 'Supabase secret key', pattern: /(?<![A-Za-z0-9_])sb_secret_[A-Za-z0-9_-]{16,}/g },
  { name: 'AWS access key', pattern: /(?<![A-Za-z0-9])(?:AKIA|ASIA)[0-9A-Z]{16}(?![A-Za-z0-9])/g },
  {
    name: 'JWT',
    pattern: /(?<![A-Za-z0-9_-])eyJ[A-Za-z0-9_-]{8,}\.eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g,
    // The jwt.io sample's subject: the token every library's docs show.
    harmless: ([token]) => claims(token)?.sub === '1234567890',
  },
  {
    name: 'Postgres URL',
    pattern: /postgres(?:ql)?:\/\/[^\s:@/'"`]+:([^\s@/'"`]+)@/g,
    // `postgres` is the local Supabase stack's own password.
    harmless: ([, password = '']) => password === 'postgres' || placeholder(password),
  },
];

const escape = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** The internal-delivery rules: a name or an address that belongs to the maintainer. */
function internalFindings(path: string, text: string): Finding[] {
  const found: Finding[] = [];
  const organisation = new RegExp(`(?<![A-Za-z0-9_.-])${escape(MAINTAINER.organisation)}/([A-Za-z0-9_.-]+)`, 'gi');
  for (const match of text.matchAll(organisation)) {
    const repository = (match[1] ?? '').toLowerCase().replace(/\.git$/, '').replace(/\.+$/, '');
    if (repository === OWN_REPOSITORY) continue;
    found.push({ path, line: lineAt(text, match.index), rule: 'internal repository', fix: 'use demo-org/<name>' });
  }
  const prefixed = new RegExp(`(?<![A-Za-z0-9_])${escape(MAINTAINER.repositoryPrefix)}(?:-[A-Za-z0-9]+)+`, 'gi');
  for (const match of text.matchAll(prefixed)) {
    if (OWN_NAMES.has(match[0].toLowerCase())) continue;
    found.push({ path, line: lineAt(text, match.index), rule: 'internal repository', fix: 'use nimbus-<rest of the name>' });
  }
  const email = new RegExp(`[A-Za-z0-9._%+-]+@(?:[A-Za-z0-9-]+\\.)*${escape(MAINTAINER.domain)}(?![A-Za-z0-9-])`, 'gi');
  for (const match of text.matchAll(email)) {
    found.push({ path, line: lineAt(text, match.index), rule: 'real email', fix: 'use <name>@example.com' });
  }
  return found;
}

/** Every secret shape in the file that neither looks harmless nor matches an allowlist entry of its own. */
function secretFindings(path: string, text: string, allowed: readonly RegExp[]): Finding[] {
  const found: Finding[] = [];
  for (const { name, pattern, harmless } of SECRETS) {
    for (const match of text.matchAll(pattern)) {
      if (harmless?.(match) || allowed.some((allow) => allow.test(match[0]))) continue;
      found.push({ path, line: lineAt(text, match.index), rule: `secret (${name})`, fix: SECRET_FIX });
    }
  }
  return found;
}

/** The allowlist's entries as patterns by file, and a problem for each entry that cannot count. */
function readAllow(allow: readonly AllowEntry[]): { byFile: Map<string, RegExp[]>; problems: string[] } {
  const byFile = new Map<string, RegExp[]>();
  const problems: string[] = [];
  allow.forEach((entry, index) => {
    const problem = allowProblem(entry);
    if (problem) problems.push(`${ALLOW_FILE}: entry ${String(index + 1)}${entry.file ? ` (${entry.file})` : ''} ${problem}`);
    else byFile.set(entry.file, [...(byFile.get(entry.file) ?? []), new RegExp(entry.pattern)]);
  });
  return { byFile, problems };
}

/** Why an allowlist entry cannot count, or null when it can. */
function allowProblem(entry: AllowEntry): string | null {
  if (!entry.file || !entry.pattern) return 'needs a file and a pattern';
  if (!entry.reason.trim()) return 'needs its reason';
  try {
    new RegExp(entry.pattern);
  } catch {
    return 'has a pattern that is no regular expression';
  }
  return null;
}

/** Every file's findings, one per line and rule. */
function scan(files: readonly SourceFile[], allowed: ReadonlyMap<string, RegExp[]>): Finding[] {
  const findings = new Map<string, Finding>();
  for (const { path, text } of files) {
    if (SKIPPED.some((skip) => skip.test(path))) continue;
    const judged = [...internalFindings(path, text), ...secretFindings(path, text, allowed.get(path) ?? [])];
    for (const finding of judged) findings.set(`${finding.path}\0${String(finding.line)}\0${finding.rule}`, finding);
  }
  return [...findings.values()];
}

/**
 * Judges `files` (the tracked files, read) against the allowlist: the findings, one per file, line and
 * rule, and the problems of the allowlist itself.
 */
export function judge(files: readonly SourceFile[], allow: readonly AllowEntry[]): Verdict {
  const allowed = readAllow(allow);
  const findings = scan(files, allowed.byFile);
  findings.sort((a, b) => a.path.localeCompare(b.path) || a.line - b.line || a.rule.localeCompare(b.rule));
  return { findings, problems: allowed.problems.sort() };
}

/** The finding as the guard prints it: no value, ever. */
export const formatFinding = (f: Finding): string => `${f.path}:${String(f.line)}: ${f.rule} — ${f.fix}`;

/** Every file git tracks under `root`, read from the work tree; binaries and skipped paths left out. */
export function trackedFiles(root: string): SourceFile[] {
  const paths = execFileSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }).split('\0');
  const files: SourceFile[] = [];
  for (const path of paths) {
    if (!path || SKIPPED.some((skip) => skip.test(path))) continue;
    let buffer: Buffer;
    try {
      buffer = readFileSync(join(root, path));
    } catch {
      continue; // a tracked path deleted in the work tree, or a submodule
    }
    if (!buffer.includes(0)) files.push({ path, text: buffer.toString('utf8') });
  }
  return files;
}

/** The allowlist under `root`: none when the file is missing. */
export function readAllowFile(root: string): AllowEntry[] {
  const file = join(root, ALLOW_FILE);
  if (!existsSync(file)) return [];
  const json: unknown = JSON.parse(readFileSync(file, 'utf8'));
  const entries = isRecord(json) && Array.isArray(json.allow) ? json.allow : [];
  return entries.map((entry) => {
    const record = isRecord(entry) ? entry : {};
    const text = (key: string): string => (typeof record[key] === 'string' ? record[key] : '');
    return { file: text('file'), pattern: text('pattern'), reason: text('reason') };
  });
}

/** Runs the guard on the repository holding `cwd`, writing its lines; answers its exit code. */
export function main(cwd: string, write: (line: string) => void = console.log, warn: (line: string) => void = console.error): number {
  const root = execFileSync('git', ['rev-parse', '--show-toplevel'], { cwd, encoding: 'utf8' }).trim();
  const files = trackedFiles(root);
  const { findings, problems } = judge(files, readAllowFile(root));
  for (const finding of findings) warn(formatFinding(finding));
  for (const problem of problems) warn(problem);
  if (findings.length + problems.length > 0) {
    warn(`open-source: red: ${String(findings.length)} finding(s), ${String(problems.length)} baseline or allowlist problem(s)`);
    return 1;
  }
  write(`open-source: green: ${String(files.length)} files read, 0 still in the baseline`);
  return 0;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) process.exit(main(process.cwd()));
