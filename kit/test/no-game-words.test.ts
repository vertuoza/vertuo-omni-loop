// The kit may depend on a URL the game's app serves (ask mode's `ask.url`), but it still never names
// the game (ADR-0002, amending PRD 3's principle 7). This guard fails on the game's world — "galaxy",
// in any case and inside any word — in every file under `kit/` that is not a test: code, the bundle,
// the plugin's skills and hooks, the README, the porting notes and the test helpers alike. The
// fuller list of game words the outbox's fun lines must avoid is kept by
// `kit/lib/outbox/banter.test.ts`; only this one word is refused kit-wide.
//
// One exception (ADR-0047, amending ADR-0002's decision 3): the arcade's production address,
// `vertuo-omni-loop-galaxy.vercel.app`, which `signature.home` defaults to. Each whole occurrence of
// that host is removed from a line before the line is tested, so the word elsewhere on the line, or
// in any other host (one merely holding the address included), still fails.
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const kitRoot = fileURLToPath(new URL('..', import.meta.url));
const GAME_WORD = /galax(?:y|ies)|galactic/i;
// The one address the kit may carry, as a whole host: no host character right before it, and none
// right after it but a path, a port or the end of the address.
const HOME_ADDRESS = /(?<![\w.-])vertuo-omni-loop-galaxy\.vercel\.app(?![\w-]|\.[\w-])/g;
const isTest = (name: string) => /\.test\.[cm]?[jt]sx?$/.test(name);

/** Every file under `dir` that is not a test, dependencies left out. */
function nonTestFiles(dir) {
  let out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules') continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) out = out.concat(nonTestFiles(path));
    else if (entry.isFile() && !isTest(entry.name)) out.push(path);
  }
  return out;
}

/** Every line naming the game's world under `root`, as `<file>:<line>: <text>`. */
function gameWordHits(root: string) {
  const hits: string[] = [];
  for (const file of nonTestFiles(root)) {
    readFileSync(file, 'utf8').split('\n').forEach((line, index) => {
      if (GAME_WORD.test(line.replace(HOME_ADDRESS, ''))) hits.push(`${relative(root, file)}:${index + 1}: ${line.trim()}`);
    });
  }
  return hits.sort();
}

function fixture(files) {
  const root = mkdtempSync(join(tmpdir(), 'omni-game-words-'));
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), text);
  }
  return root;
}

describe('the kit never names the game', () => {
  it('no file under kit/ but a test says "galaxy"', () => {
    expect(gameWordHits(kitRoot)).toEqual([]);
  });

  it('would catch it in code, the bundle, a skill, the hooks, the plugin manifest and the README, in any case', () => {
    const root = fixture({
      'lib/ask/where.mjs': "export const HOST = 'galaxy.example.com';\n",
      'dist/omni.mjs': '// the Galaxy app\n',
      'plugin/skills/ask/SKILL.md': '---\nname: ask\n---\nAnswer on the GALAXY page.\n',
      'plugin/hooks/hooks.json': '{ "description": "galaxies far away" }\n',
      'plugin/.claude-plugin/plugin.json': '{ "description": "intergalactic" }\n',
      'README.md': 'Fine here.\nNot the @omni/galaxy-app.\n',
      'test/fake-server.mjs': '// a fake galaxy\n',
    });
    expect(gameWordHits(root)).toEqual([
      'README.md:2: Not the @omni/galaxy-app.',
      'dist/omni.mjs:1: // the Galaxy app',
      'lib/ask/where.mjs:1: export const HOST = \'galaxy.example.com\';',
      'plugin/.claude-plugin/plugin.json:1: { "description": "intergalactic" }',
      'plugin/hooks/hooks.json:1: { "description": "galaxies far away" }',
      'plugin/skills/ask/SKILL.md:4: Answer on the GALAXY page.',
      'test/fake-server.mjs:1: // a fake galaxy',
    ]);
  });

  it('lets the arcade\'s exact address through, and nothing else (ADR-0047)', () => {
    const root = fixture({
      'lib/config.mjs': "home: httpsUrl.default('https://vertuo-omni-loop-galaxy.vercel.app'),\n",
      'dist/omni.mjs':
        '// [Omni Loop](https://vertuo-omni-loop-galaxy.vercel.app) or https://vertuo-omni-loop-galaxy.vercel.app/ask.\n',
      'lib/same-line.mjs': "const HOME = 'https://vertuo-omni-loop-galaxy.vercel.app'; // the galaxy app\n",
      'lib/other-host.mjs': "const HOME = 'https://galaxy.example.com';\n",
      'lib/longer-hosts.mjs': [
        "'https://evil-vertuo-omni-loop-galaxy.vercel.app'",
        "'https://x.vertuo-omni-loop-galaxy.vercel.app'",
        "'https://vertuo-omni-loop-galaxy.vercel.app.evil.example'",
        "'https://vertuo-omni-loop-galaxy.vercel.apps'",
        "'https://vertuo-omni-loop-galaxy2.vercel.app'",
        '',
      ].join('\n'),
    });
    expect(gameWordHits(root)).toEqual([
      "lib/longer-hosts.mjs:1: 'https://evil-vertuo-omni-loop-galaxy.vercel.app'",
      "lib/longer-hosts.mjs:2: 'https://x.vertuo-omni-loop-galaxy.vercel.app'",
      "lib/longer-hosts.mjs:3: 'https://vertuo-omni-loop-galaxy.vercel.app.evil.example'",
      "lib/longer-hosts.mjs:4: 'https://vertuo-omni-loop-galaxy.vercel.apps'",
      "lib/longer-hosts.mjs:5: 'https://vertuo-omni-loop-galaxy2.vercel.app'",
      "lib/other-host.mjs:1: const HOME = 'https://galaxy.example.com';",
      "lib/same-line.mjs:1: const HOME = 'https://vertuo-omni-loop-galaxy.vercel.app'; // the galaxy app",
    ]);
  });

  it('leaves tests and dependencies alone', () => {
    const root = fixture({
      'lib/outbox/banter.test.mjs': "const WORDS = ['galaxy'];\n",
      'lib/ask/page.test.ts': '// galaxy\n',
      'node_modules/some-dep/index.js': 'galaxy\n',
      'lib/clean.mjs': 'export const clean = true;\n',
    });
    expect(gameWordHits(root)).toEqual([]);
  });
});
