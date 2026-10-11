// PRD 1548, slice s11: `/omni:mega-brainstorm --product <key>` runs from any kitted checkout of a
// repository the product holds, remembers the product, refuses a target on `phase0: pr` by name, and
// ends with a product PRD on its page, no issue and no pull request. Each point of the slice's "done
// when" is read here against the skill's SKILL.md text. The refusal line is the one
// `omni product phase0` prints (`../lib/product/checkout.ts`), so the prose cannot drift from it.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { phase0Line } from '../lib/product/checkout.ts';

const TEXT = readFileSync(new URL('../plugin/skills/mega-brainstorm/SKILL.md', import.meta.url), 'utf8');
const REFUSAL = phase0Line('<repo>', { flag: 'pr', why: null }).line;

/** The `## ` headings of a text, outside fenced blocks, in order. */
function headings(text: string) {
  let fenced = false;
  const out = [];
  for (const line of text.split('\n')) {
    if (line.trim().startsWith('```')) fenced = !fenced;
    else if (!fenced && line.startsWith('## ')) out.push(line.slice(3));
  }
  return out;
}

/** The section whose `## ` heading starts with `start`, up to the next `## ` heading outside a fence. */
function section(text: string, start: string) {
  const lines = text.split('\n');
  let fenced = false;
  let from = -1;
  for (const [index, line] of lines.entries()) {
    if (line.trim().startsWith('```')) fenced = !fenced;
    else if (!fenced && line.startsWith('## ')) {
      if (from >= 0) return lines.slice(from, index).join('\n');
      if (line.startsWith(`## ${start}`)) from = index;
    }
  }
  return from < 0 ? '' : lines.slice(from).join('\n');
}

/** A text with each run of whitespace made one space: prose wraps its lines anywhere. */
const flat = (text: string) => text.replace(/\s+/g, ' ');

/** The lines of each fenced block of a text. */
function fencedLines(text: string) {
  let fenced = false;
  const out: string[] = [];
  for (const line of text.split('\n')) {
    if (line.trim().startsWith('```')) fenced = !fenced;
    else if (fenced) out.push(line.trim());
  }
  return out;
}

/** Whether `phrases` appear in `text` in that order. */
function inOrder(text: string, phrases: string[]) {
  let at = 0;
  for (const phrase of phrases) {
    const found = text.indexOf(phrase, at);
    if (found < 0) return phrase;
    at = found + phrase.length;
  }
  return null;
}

const PRODUCT = flat(section(TEXT, 'From a product'));

describe('/omni:mega-brainstorm --product <key> (PRD 1548)', () => {
  it('takes --product <key>, says so in its description, and reads it right after step 0', () => {
    const description = /^description: (.*)$/m.exec(TEXT)?.[1] ?? '';
    expect(description).toContain('--product <key>');
    expect(description).toContain('no issue');
    expect(headings(TEXT).slice(0, 2)).toEqual(['Step 0', 'From a product (`--product <key>`)']);
    expect(PRODUCT).toContain('any checkout of a repository the product holds that has the kit installed');
  });

  it('runs outside a plan repository only as a product run, and keeps a plain run as it is', () => {
    const step0 = flat(section(TEXT, 'Step 0'));
    expect(step0).toContain('**From a product**');
    expect(step0).toContain('not a plan repository: run /omni:mega-invade first, or /omni:brainstorm for this repository alone');
    expect(PRODUCT).toContain('Without `--product` and with nothing remembered, the skill runs as written');
  });

  it('remembers the product with omni product use, and reads it back with omni product which', () => {
    expect(inOrder(PRODUCT, ['node .omni-loop/bin/omni.mjs product use <key>', 'product <key> remembered in this checkout'])).toBeNull();
    expect(PRODUCT).toContain('node .omni-loop/bin/omni.mjs product which');
    expect(PRODUCT).toContain('`remembered: <key>`');
    expect(PRODUCT).toContain('the remembered product');
  });

  it("refuses a target on phase0: pr by name, with acceptance 10's line, before any clone", () => {
    expect(REFUSAL).toBe('<repo> is phase0: pr · switch it to server on its Omni page, or leave it out');
    expect(fencedLines(section(TEXT, 'From a product'))).toContain(REFUSAL);
    expect(inOrder(PRODUCT, ['Once the design is approved', 'before step 3 clones', 'node .omni-loop/bin/omni.mjs product phase0 <owner/name>…'])).toBeNull();
    expect(PRODUCT).toContain('`<repo>: its phase0 could not be read: <why>`');
  });

  it('creates the product PRD on the server and ends on its page, with no issue and no pull request', () => {
    expect(inOrder(PRODUCT, [
      'node .omni-loop/bin/omni.mjs dossier push --product <key> --new --from <prd folder>',
      '`<key>-<n>`',
      'node .omni-loop/bin/omni.mjs dossier push <key>-<n> --from <prd folder>',
      'node .omni-loop/bin/omni.mjs prd <key>-<n>',
    ])).toBeNull();
    for (const none of ['no PRD issue', 'no feature branch', 'no commit', 'no phase-0 PR', 'no feature PR', 'no plan PR']) expect(PRODUCT).toContain(none);
    expect(PRODUCT).toContain('`phase0: server`');
  });

  it('hands off to the PRD page, then /omni:ultra-yolo <key>-<n>', () => {
    const lines = fencedLines(section(TEXT, 'From a product'));
    expect(lines).toContain('1. Review and approve PRD <key>-<n> on its page: <page link>');
    expect(lines.at(-1)).toBe('/omni:ultra-yolo <key>-<n>');
    expect(PRODUCT).toContain('the link `dossier push` printed');
  });
});
