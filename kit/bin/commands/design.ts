// `omni design touched [<base>]` (PRD 1369): whether the branch's diff since its merge base with
// `<base>` touches a screen — `design: off` while `design.enabled` is false, else `ui: yes` and the
// matching paths, `ui: no`, or `ui: unknown` (`design.paths` empty, or a base git cannot read). The
// base defaults to the branch's own (`kit/lib/design/base.ts`). It only reports: every answer exits 0;
// only a usage mistake exits 2. Below its answer, PRD 1407 adds one `screens:` line naming each
// library screen whose `implements` a changed path matches (the `design.paths` semantics), with its
// status and routes; no line when none does, while the flag is off, or when the base cannot be read.
// PRD 1550: it first drops every changed path a `design.ignore` glob matches (by default the common
// test shapes); a screen reached only through its `reads` is named `reads <screen>` on the same line
// and never as a locked screen; and each screen whose `implements` changed while its mockup did not
// gets a `mock may be stale: <screen>` line, a note that never blocks.
//
// `omni design screens` (PRD 1407): the screen library at `design.screens` — one line per screen,
// its name, status, who locked it and when, and its routes, then each file that does not read; it says
// so when the library is empty, and prints `design: off` while the flag is off. Always exit 0.
//
// `omni design words <page>…` (PRD 1407): the word pass over each mockup page — every screen's
// visible strings and word count, then its findings (`kit/lib/design/words/`), the avoided words
// being `design.words.avoid`, the explicit list the `design` form's `product` section holds and (PRD
// 1795 s6) the avoided words of the product's glossary in its local copy, never the server. A page
// it cannot read is named and the next is read. It prints `design: off` while the flag is off, and
// exits 0 whatever it finds.
//
// `omni design gallery [--out <file>]` (PRD 1550): one self-contained HTML page of the whole library
// (`kit/lib/design/gallery/`), written by default to a fresh folder under the system's temporary
// folder, or to `--out` (read from the repository root), and its path printed. Generated each time,
// never committed. An empty library prints `no screen yet` and writes nothing; `design: off` while
// the flag is off. It exits 0 whatever it finds; only a usage mistake exits 2.
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { designScreensDir } from '../../lib/config.ts';
import { defaultDesignBase } from '../../lib/design/base.ts';
import { galleryPage } from '../../lib/design/gallery/page.ts';
import { designIgnore, dropIgnored } from '../../lib/design/ignore.ts';
import { formatScreens, readScreens } from '../../lib/design/screens.ts';
import { avoidedWords } from '../../lib/design/words/avoid.ts';
import { productAvoids } from '../../lib/design/words/product.ts';
import { wordsContent } from '../../lib/design/words/content.ts';
import { formatPage, wordPass, type WordRules } from '../../lib/design/words/pass.ts';
import { parseSelector, type Selector } from '../../lib/design/words/selector.ts';
import { messageOf } from '../../lib/narrow.ts';
import { readForm } from '../../lib/playbook/forms.ts';
import { designTouched, formatScreensTouched, formatStaleMocks, formatTouched, screensRead, screensTouched, staleMocks } from '../../lib/design/touched.ts';
import { branchPaths } from '../branch-range.ts';
import { parseArgs, println, usageError } from '../args.ts';
import type { Command, CommandIo } from '../io.ts';
import { synchronous } from '../synchronous.ts';

const USAGE = 'usage: omni design touched [<base>] | omni design screens | omni design words <page.html>… | omni design gallery [--out <file>]';

/** The checked-out branch, or null on a detached head or when git cannot say. */
function currentBranch({ ctx, exec }: CommandIo): string | null {
  try {
    const name = exec('git', ['symbolic-ref', '--quiet', '--short', 'HEAD'], { cwd: ctx.root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    return name || null;
  } catch {
    return null;
  }
}

/** The answer, then the `screens:` line when a library screen's `implements` or `reads` matches a changed path, then each stale mockup. */
function touched(io: CommandIo, given: string | undefined): string[] {
  const { design } = io.ctx.config;
  if (!design.enabled) return formatTouched(designTouched(design, []));
  const base = given ?? defaultDesignBase(currentBranch(io), io.ctx.config);
  let changed: string[];
  try {
    changed = branchPaths(io.ctx.root, base, io.exec);
  } catch {
    return formatTouched({ ui: 'unknown', reason: `cannot read ${base} — fetch it or pass another base` });
  }
  const kept = dropIgnored(designIgnore(design), changed);
  const dir = designScreensDir(io.ctx.config);
  const { screens: library } = readScreens(join(io.ctx.root, dir));
  const hit = screensTouched(library, kept);
  return [
    ...formatTouched(designTouched(design, kept)),
    ...formatScreensTouched(hit, screensRead(library, kept)),
    ...formatStaleMocks(staleMocks(hit, changed, dir)),
  ];
}

function screens({ ctx }: CommandIo): string[] {
  if (!ctx.config.design.enabled) return ['design: off'];
  const dir = designScreensDir(ctx.config);
  return formatScreens(readScreens(join(ctx.root, dir)), dir);
}

/** The library's gallery page written to `out` (else a fresh temporary folder), and its path; nothing written when the library is empty. */
function gallery({ ctx }: CommandIo, out: string | undefined): string[] {
  if (!ctx.config.design.enabled) return ['design: off'];
  const dir = join(ctx.root, designScreensDir(ctx.config));
  const library = readScreens(dir);
  if (library.screens.length === 0) return ['no screen yet'];
  const readMock = (mock: string): string | null => {
    try {
      return readFileSync(join(dir, mock), 'utf8');
    } catch {
      return null;
    }
  };
  const path = out === undefined ? join(mkdtempSync(join(tmpdir(), 'omni-design-gallery-')), 'gallery.html') : resolve(ctx.root, out);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, galleryPage(library, readMock));
  return [path];
}

/** A selector the config has already checked. */
function checked(source: string): Selector {
  const selector = parseSelector(source);
  if (!selector) throw new Error(`the config let through a selector it should refuse: ${source}`);
  return selector;
}

/** The words the `design` form's `product` section lists as avoided; none when the form or the list is not there. */
function formAvoids(io: CommandIo): string[] {
  const read = readForm('design', { ctx: io.ctx });
  if (!read.exists || !read.ok) return [];
  const product = read.form.slots.find((slot) => slot.id === 'product');
  return product && product.body.kind === 'text' ? avoidedWords(product.body.text) : [];
}

/** The terms once each, in order, compared without case. */
function dedupe(terms: readonly string[]): string[] {
  const seen = new Set<string>();
  return terms.filter((term) => {
    const key = term.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function words(io: CommandIo, pages: readonly string[]): string[] {
  const { design: config } = io.ctx.config;
  if (!config.enabled) return ['design: off'];
  const fromForm = formAvoids(io);
  const product = productAvoids(io.ctx.root);
  const known = new Set(fromForm.map((term) => term.toLowerCase()));
  const rules: WordRules = {
    sentence: config.words.sentence,
    screen: checked(config.words.screen),
    primary: checked(config.words.primary),
    content: checked(wordsContent(config.words)),
    avoid: dedupe([...fromForm, ...config.words.avoid.filter((term) => !known.has(term.toLowerCase())), ...product.words]),
    says: product.says,
  };
  return pages.flatMap((page) => {
    let html: string;
    try {
      html = readFileSync(resolve(io.ctx.root, page), 'utf8');
    } catch (error) {
      return [`${page}: cannot read — ${messageOf(error).split('\n')[0]}`];
    }
    return formatPage(page, wordPass(html, rules), rules);
  });
}

/** Each verb's lines from its operands, or null when the operands are a usage mistake. */
const VERBS: Readonly<Record<string, (io: CommandIo, operands: readonly string[], out: string | undefined) => string[] | null>> = {
  touched: (io, operands) => (operands.length > 1 ? null : touched(io, operands[0])),
  screens: (io, operands) => (operands.length > 0 ? null : screens(io)),
  words: (io, operands) => (operands.length === 0 ? null : words(io, operands)),
  gallery: (io, operands, out) => (operands.length > 0 ? null : gallery(io, out)),
};

export const design: Command = {
  run: synchronous((args: string[], io: CommandIo): number => {
    const { positional, flags } = parseArgs('design', args, { values: ['out'] });
    const [verb = '', ...operands] = positional;
    if (flags.out !== undefined && verb !== 'gallery') throw usageError(USAGE);
    const lines = Object.hasOwn(VERBS, verb) ? VERBS[verb]?.(io, operands, flags.out) : null;
    if (!lines) throw usageError(USAGE);
    for (const line of lines) println(io.stdout, line);
    return 0;
  }),
};
