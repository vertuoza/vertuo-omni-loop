import { mkdirSync, mkdtempSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const kitRoot = fileURLToPath(new URL('..', import.meta.url));
// Kit code, and the plugin's skill prose.
const SCANNED = [
  { dir: 'lib', ext: '.mjs' },
  { dir: 'bin', ext: '.mjs' },
  { dir: 'plugin', ext: '.md' },
];
const FORBIDDEN = [/vertuo/i, /\bdocs\//, /\brepoRoot\b/, /pierrederval/, /'omni:outbox-go'/, /'omni:feature'/];
// A provenance line, in code (`// …`) or in Markdown (`<!-- … -->`).
const PROVENANCE = /^(?:\/\/|<!--) Ported from vertuo-ai-domain@/;

// Controller ruling: exempt kit/lib/config.mjs from exactly these patterns (per-pattern list)
const EXEMPT_PATHS = {
  "'omni:outbox-go'": ['lib/config.mjs'],
  "'omni:feature'": ['lib/config.mjs'],
  '\\bdocs\\/': ['lib/config.mjs'],
};

function files(dir, ext) {
  let out = [];
  let names = [];
  try { names = readdirSync(dir); } catch { return out; }
  for (const name of names) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) out = out.concat(files(path, ext));
    else if (name.endsWith(ext) && !name.endsWith('.test.mjs')) out.push(path);
  }
  return out;
}

/** Every forbidden literal under `root`, as `<file>:<line>: <text>`, outside provenance lines. */
function literalHits(root) {
  const hits = [];
  for (const { dir, ext } of SCANNED) {
    for (const file of files(join(root, dir), ext)) {
      const relPath = relative(root, file);
      readFileSync(file, 'utf8').split('\n').forEach((line, index) => {
        if (PROVENANCE.test(line.trim())) return;
        for (const pattern of FORBIDDEN) {
          const exempt = EXEMPT_PATHS[pattern.source] || [];
          if (exempt.includes(relPath)) continue;
          if (pattern.test(line)) hits.push(`${relPath}:${index + 1}: ${line.trim()}`);
        }
      });
    }
  }
  return hits;
}

describe('kit source carries no repository literal', () => {
  it('finds none outside provenance lines', () => {
    expect(literalHits(kitRoot)).toEqual([]);
  });

  it('scans skill prose under plugin/, and exempts its provenance lines', () => {
    const root = mkdtempSync(join(tmpdir(), 'omni-literals-'));
    const write = (path, text) => {
      mkdirSync(dirname(join(root, path)), { recursive: true });
      writeFileSync(join(root, path), text);
    };
    write('plugin/skills/s/SKILL.md', [
      '<!-- Ported from vertuo-ai-domain@c4a210122:.claude/skills/vertuo-x/SKILL.md -->',
      'Read the spec in docs/specs.',
      'Label it `omni:outbox-go`.',
      'Run it the Vertuoza way.',
    ].join('\n'));
    write('plugin/skills/s/notes.txt', 'vertuo is fine in a file the scan does not cover\n');
    expect(literalHits(root)).toEqual([
      'plugin/skills/s/SKILL.md:2: Read the spec in docs/specs.',
      'plugin/skills/s/SKILL.md:4: Run it the Vertuoza way.',
    ]);
  });
});
