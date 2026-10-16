// PRD 2011, slice s9: `/omni:mega-bug-fix --product <key>` records the bug on the server as
// `<key>-B<n>` with its Fixes rows, opens each fix pull request with a body that starts `Fixes
// <key>-B<n> · <link>` and carries the reproduction and guard lines, and opens no record pull request
// and no plan-repository issue. Each point of the slice's "done when" is read here against SKILL.md.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const TEXT = readFileSync(new URL('../plugin/skills/mega-bug-fix/SKILL.md', import.meta.url), 'utf8');

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

const PRODUCT = flat(section(TEXT, 'From a product'));

describe('/omni:mega-bug-fix --product <key> (PRD 2011)', () => {
  it('takes --product <key> and says so in its description and its input table', () => {
    const description = /^description: (.*)$/m.exec(TEXT)?.[1] ?? '';
    expect(description).toContain('--product <key>');
    expect(description).toContain('no record PR');
    expect(flat(section(TEXT, 'Input'))).toContain('`--product <key>`');
    expect(PRODUCT).not.toBe('');
  });

  it('runs outside a plan repository only as a product run, and keeps a plain run as it is', () => {
    const step0 = flat(section(TEXT, 'Step 0'));
    expect(step0).toContain('**From a product**');
    expect(step0).toContain('not a plan repository: /omni:bug-fix');
  });

  it('records the bug with omni bug check and push before any pull request opens, so the id is known', () => {
    expect(PRODUCT).toContain('omni.mjs bug check --product <key>');
    expect(PRODUCT).toContain('omni.mjs bug push --product <key> --new');
    expect(PRODUCT).toContain('`<key>-B<n>`');
    const order = ['bug check --product', 'bug push --product <key> --new', 'Fixes <key>-B<n> ·', '--bug <n>'].map((p) => PRODUCT.indexOf(p));
    expect(order.every((at) => at >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });

  it('opens each fix PR with Fixes <key>-B<n> · <link>, then the reproduction and guard lines', () => {
    const body = section(TEXT, 'From a product');
    expect(body).toContain('Fixes <key>-B<n> · <link>');
    expect(PRODUCT).toContain('then the reproduction line and the guard line');
    expect(PRODUCT).toContain('`git log` and blame');
  });

  it('opens no record PR and no plan-repository issue, and never closes anything', () => {
    expect(PRODUCT).toContain('opens no record PR');
    expect(PRODUCT).toContain('no plan-repository issue');
    expect(PRODUCT).toContain('never a closing keyword');
  });

  it('leaves the merge to the App: the last merged row ships the record', () => {
    expect(PRODUCT).toContain('the App stamps');
    expect(PRODUCT).toContain('Merge after');
  });
});
