import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const kitRoot = fileURLToPath(new URL('..', import.meta.url));
const SCANNED = ['lib', 'bin'];
const FORBIDDEN = [/vertuo/i, /\bdocs\//, /\brepoRoot\b/, /pierrederval/, /'outbox:go'/, /'pr:feature'/];
const PROVENANCE = /^\/\/ Ported from vertuo-ai-domain@/;

// Controller ruling: exempt kit/lib/config.mjs from exactly these patterns (per-pattern list)
const EXEMPT_PATHS = {
  "'outbox:go'": ['lib/config.mjs'],
  "'pr:feature'": ['lib/config.mjs'],
  '\\bdocs\\/': ['lib/config.mjs'],
};

function files(dir) {
  let out = [];
  let names = [];
  try { names = readdirSync(dir); } catch { return out; }
  for (const name of names) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) out = out.concat(files(path));
    else if (name.endsWith('.mjs') && !name.endsWith('.test.mjs')) out.push(path);
  }
  return out;
}

describe('kit source carries no repository literal', () => {
  it('finds none outside provenance lines', () => {
    const hits = [];
    for (const dir of SCANNED) {
      for (const file of files(join(kitRoot, dir))) {
        const relPath = relative(kitRoot, file);
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
    expect(hits).toEqual([]);
  });
});
