import { mkdirSync, mkdtempSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const kitRoot = fileURLToPath(new URL('..', import.meta.url));
// Kit code, the plugin's skill prose, and the kit defaults. A kit default also names no package
// manager and no upstream record or issue number: a repository's commands reach it only as
// `{config:commands.*}`.
const SCANNED = [
  { dir: 'lib', ext: '.mjs' },
  { dir: 'bin', ext: '.mjs' },
  { dir: 'plugin', ext: '.md' },
  { dir: 'templates', ext: '.md', also: [/\b(?:pnpm|npm|npx|yarn)\b/, /\bADR[ -]?\d/, /#\d/] },
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

// One value let through (ADR-0047, outbox item s1-01 of PRD 215): the arcade's production address,
// the default of `signature.home`, in `lib/config.mjs` only. Each whole occurrence of its host (the
// boundary `kit/test/no-game-words.test.mjs` uses) is removed from a line before the line is
// tested, so every other hit on that line, in that file or any other, still fails.
const EXEMPT_VALUES = {
  'lib/config.mjs': [/(?<![\w.-])vertuo-omni-loop-galaxy\.vercel\.app(?![\w-]|\.[\w-])/g],
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
  for (const { dir, ext, also = [] } of SCANNED) {
    for (const file of files(join(root, dir), ext)) {
      const relPath = relative(root, file);
      readFileSync(file, 'utf8').split('\n').forEach((line, index) => {
        if (PROVENANCE.test(line.trim())) return;
        const tested = (EXEMPT_VALUES[relPath] || []).reduce((rest, value) => rest.replace(value, ''), line);
        for (const pattern of [...FORBIDDEN, ...also]) {
          const exempt = EXEMPT_PATHS[pattern.source] || [];
          if (exempt.includes(relPath)) continue;
          if (pattern.test(tested)) hits.push(`${relPath}:${index + 1}: ${line.trim()}`);
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

  it('scans the kit defaults under templates/, and exempts their provenance lines', () => {
    const root = mkdtempSync(join(tmpdir(), 'omni-literals-'));
    const write = (path, text) => {
      mkdirSync(dirname(join(root, path)), { recursive: true });
      writeFileSync(join(root, path), text);
    };
    write('templates/playbook/testing.md', [
      '<!-- Ported from vertuo-ai-domain@db67fd9da:docs/agents/testing.md — changes in kit/porting/templates--testing.md -->',
      'Run `{config:commands.test}`, never `pnpm test`.',
      'Read docs/agents/testing.md first.',
      'See ADR 0058, and #120.',
      'The suite runs in `npx vitest`.',
    ].join('\n'));
    write('templates/README.md', 'The vertuo way.\n');
    expect(literalHits(root)).toEqual([
      'templates/README.md:1: The vertuo way.',
      'templates/playbook/testing.md:2: Run `{config:commands.test}`, never `pnpm test`.',
      'templates/playbook/testing.md:3: Read docs/agents/testing.md first.',
      'templates/playbook/testing.md:4: See ADR 0058, and #120.',
      'templates/playbook/testing.md:4: See ADR 0058, and #120.',
      'templates/playbook/testing.md:5: The suite runs in `npx vitest`.',
    ]);
  });

  it('lets the arcade\'s exact address through in lib/config.mjs only, and nothing else (ADR-0047)', () => {
    const root = mkdtempSync(join(tmpdir(), 'omni-literals-'));
    const write = (path, text) => {
      mkdirSync(dirname(join(root, path)), { recursive: true });
      writeFileSync(join(root, path), text);
    };
    write('lib/config.mjs', [
      "home: httpsUrl.default('https://vertuo-omni-loop-galaxy.vercel.app'),",
      "slug: 'vertuoza/widgets',",
      "home: 'https://vertuo-omni-loop-galaxy.vercel.app', // the vertuo way",
      "home: 'https://evil-vertuo-omni-loop-galaxy.vercel.app',",
    ].join('\n'));
    write('lib/signature.mjs', "const HOME = 'https://vertuo-omni-loop-galaxy.vercel.app';\n");
    expect(literalHits(root)).toEqual([
      "lib/config.mjs:2: slug: 'vertuoza/widgets',",
      "lib/config.mjs:3: home: 'https://vertuo-omni-loop-galaxy.vercel.app', // the vertuo way",
      "lib/config.mjs:4: home: 'https://evil-vertuo-omni-loop-galaxy.vercel.app',",
      "lib/signature.mjs:1: const HOME = 'https://vertuo-omni-loop-galaxy.vercel.app';",
    ]);
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
