// `omni design touched [<base>]` (PRD 1369): whether the branch's diff since its merge base with
// `<base>` touches a screen — `design: off` while `design.enabled` is false, else `ui: yes` and the
// matching paths, `ui: no`, or `ui: unknown` (`design.paths` empty, or a base git cannot read). The
// base defaults to the branch's own (`kit/lib/design/base.ts`). It only reports: every answer exits 0;
// only a usage mistake exits 2.
//
// `omni design screens` (PRD 1407): the screen library at `design.screens` — one line per screen,
// its name, status, who locked it and when, and its routes, then each file that does not read; it says
// so when the library is empty, and prints `design: off` while the flag is off. Always exit 0.
//
// `omni design words <page>…` (PRD 1407): the word pass over each mockup page — every screen's
// visible strings and word count, then its findings (`kit/lib/design/words/`), the avoided words
// being `design.words.avoid` and the explicit list the `design` form's `product` section holds. A page
// it cannot read is named and the next is read. It prints `design: off` while the flag is off, and
// exits 0 whatever it finds.
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { designScreensDir } from '../../lib/config.ts';
import { defaultDesignBase } from '../../lib/design/base.ts';
import { formatScreens, readScreens } from '../../lib/design/screens.ts';
import { avoidedWords } from '../../lib/design/words/avoid.ts';
import { formatPage, wordPass, type WordRules } from '../../lib/design/words/pass.ts';
import { parseSelector, type Selector } from '../../lib/design/words/selector.ts';
import { messageOf } from '../../lib/narrow.ts';
import { readForm } from '../../lib/playbook/forms.ts';
import { designTouched, formatTouched, type Touched } from '../../lib/design/touched.ts';
import { branchPaths } from '../branch-range.ts';
import { parseArgs, println, usageError } from '../args.ts';
import type { Command, CommandIo } from '../io.ts';
import { synchronous } from '../synchronous.ts';

const USAGE = 'usage: omni design touched [<base>] | omni design screens | omni design words <page.html>…';

/** The checked-out branch, or null on a detached head or when git cannot say. */
function currentBranch({ ctx, exec }: CommandIo): string | null {
  try {
    const name = exec('git', ['symbolic-ref', '--quiet', '--short', 'HEAD'], { cwd: ctx.root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    return name || null;
  } catch {
    return null;
  }
}

function touched(io: CommandIo, given: string | undefined): Touched {
  const { design } = io.ctx.config;
  if (!design.enabled) return designTouched(design, []);
  const base = given ?? defaultDesignBase(currentBranch(io), io.ctx.config);
  let changed: string[];
  try {
    changed = branchPaths(io.ctx.root, base, io.exec);
  } catch {
    return { ui: 'unknown', reason: `cannot read ${base} — fetch it or pass another base` };
  }
  return designTouched(design, changed);
}

function screens({ ctx }: CommandIo): string[] {
  if (!ctx.config.design.enabled) return ['design: off'];
  const dir = designScreensDir(ctx.config);
  return formatScreens(readScreens(join(ctx.root, dir)), dir);
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

function words(io: CommandIo, pages: readonly string[]): string[] {
  const { design: config } = io.ctx.config;
  if (!config.enabled) return ['design: off'];
  const fromForm = formAvoids(io);
  const known = new Set(fromForm.map((term) => term.toLowerCase()));
  const rules: WordRules = {
    sentence: config.words.sentence,
    screen: checked(config.words.screen),
    primary: checked(config.words.primary),
    avoid: [...fromForm, ...config.words.avoid.filter((term) => !known.has(term.toLowerCase()))],
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
const VERBS: Readonly<Record<string, (io: CommandIo, operands: readonly string[]) => string[] | null>> = {
  touched: (io, operands) => (operands.length > 1 ? null : formatTouched(touched(io, operands[0]))),
  screens: (io, operands) => (operands.length > 0 ? null : screens(io)),
  words: (io, operands) => (operands.length === 0 ? null : words(io, operands)),
};

export const design: Command = {
  run: synchronous((args: string[], io: CommandIo): number => {
    const [verb = '', ...operands] = parseArgs('design', args).positional;
    const lines = Object.hasOwn(VERBS, verb) ? VERBS[verb]?.(io, operands) : null;
    if (!lines) throw usageError(USAGE);
    for (const line of lines) println(io.stdout, line);
    return 0;
  }),
};
