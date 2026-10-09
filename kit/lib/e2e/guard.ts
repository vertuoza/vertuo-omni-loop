// PRD 1276: `omni e2e guard` - a credential must never enter `e2e.dir` or a sub-PR's files. This reads
// text and reports `file:line` and the kind of shape; it never returns, prints or logs a matched value.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

/** One refusal: where, and what shape it looked like. Never the value. */
export type Finding = { readonly file: string; readonly line: number; readonly kind: string };

const MAX_BYTES = 1_000_000;
/** The saved-session file name `e2e.setup` writes: refused by name wherever it sits. */
const SESSION_FILE = 'storage-state.json';
/** A value that is obviously a placeholder, not a secret. */
const PLACEHOLDER = /^(?:x+|\*+|\.+|<[^>]*>|\$\{?[A-Za-z_][A-Za-z0-9_]*\}?|process\.env[.\w[\]'"]*|env\.\w+|null|undefined|true|false|changeme|password|secret|token|your[-_ ].*|example.*|redacted.*)$/i;

const NAME = String.raw`[\w.-]*(?:pass(?:word|wd)?|pwd|secret|token|api[-_]?key|apikey|private[-_]?key|access[-_]?key|credential)[\w.-]*`;
/** `name = "value"`, `name: value`, `"name": "value"`: the value is group 1, 2 or 3. */
const ASSIGNMENT = new RegExp(String.raw`(?:^|[^\w])${NAME}["']?\s*[:=]\s*(?:"([^"\n]{6,})"|'([^'\n]{6,})'|([^\s"'#,;{}()\[\]<>$]{6,}))`, 'i');

const SHAPES: readonly { kind: string; test: (line: string) => boolean }[] = [
  { kind: 'private key', test: (l) => /-----BEGIN [A-Z ]*PRIVATE KEY-----/.test(l) },
  { kind: 'bearer token', test: (l) => /\bBearer\s+[A-Za-z0-9._~+/-]{16,}=*/.test(l) },
  { kind: 'JSON web token', test: (l) => /\beyJ[A-Za-z0-9_-]{8,}\.eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{4,}/.test(l) },
  { kind: 'access key', test: (l) => /\b(?:AKIA[0-9A-Z]{16}|gh[pousr]_[A-Za-z0-9]{30,}|sk-[A-Za-z0-9_-]{20,}|xox[abprs]-[A-Za-z0-9-]{10,})\b/.test(l) },
  { kind: 'url with a password', test: (l) => /\b[a-z][a-z0-9+.-]*:\/\/[^\s/:@]+:[^\s/@]{3,}@/i.test(l) },
  { kind: 'session state', test: (l) => /"cookies"\s*:\s*\[/.test(l) || /"origins"\s*:\s*\[/.test(l) },
  {
    kind: 'password, token or key',
    test: (l) => {
      const match = ASSIGNMENT.exec(l);
      const value = match?.[1] ?? match?.[2] ?? match?.[3];
      return value !== undefined && !PLACEHOLDER.test(value);
    },
  },
];

/** The findings of one file's text, one per line at most. */
export function scanText(file: string, text: string): Finding[] {
  const findings: Finding[] = [];
  text.split('\n').forEach((line, index) => {
    const shape = SHAPES.find((s) => s.test(line));
    if (shape) findings.push({ file, line: index + 1, kind: shape.kind });
  });
  return findings;
}

/** Whether a path is inside the framework's recording cache, which the guard leaves alone. */
const inCache = (path: string): boolean => path.includes('.e2e/cache/');

function walk(root: string, dir: string, out: string[]): void {
  let names: string[];
  try {
    names = readdirSync(join(root, dir));
  } catch {
    return;
  }
  for (const name of names.sort()) {
    if (name === 'node_modules' || name === '.git') continue;
    const path = `${dir}/${name}`;
    if (statSync(join(root, path)).isDirectory()) walk(root, path, out);
    else out.push(path);
  }
}

/** The files of `dir` under `root`, as repository-relative paths. */
export function filesUnder(root: string, dir: string): string[] {
  const out: string[] = [];
  walk(root, dir.replace(/\/+$/, ''), out);
  return out;
}

/** Scans `files` (repository-relative) under `root`: the session file by name, the rest by line. */
export function guardFiles(root: string, files: readonly string[]): Finding[] {
  const findings: Finding[] = [];
  for (const file of [...new Set(files)].sort()) {
    if (inCache(file)) continue;
    if (file.split('/').pop() === SESSION_FILE) {
      findings.push({ file, line: 1, kind: 'saved session' });
      continue;
    }
    let text: string;
    try {
      if (statSync(join(root, file)).size > MAX_BYTES) continue;
      const buffer = readFileSync(join(root, file));
      if (buffer.includes(0)) continue;
      text = buffer.toString('utf8');
    } catch {
      continue;
    }
    findings.push(...scanText(file, text));
  }
  return findings;
}
