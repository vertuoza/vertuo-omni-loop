// PRD omni-loop-21, slice s5: `/omni:mega-brainstorm --product <key> --plan-only <key>-<n>` writes only the
// plan of an existing product PRD from its spec, pushes it to its page as a new plan version, asks
// nobody under `OMNI_UNATTENDED`, and refuses a PRD with no spec in one line. Each point of the
// slice's "done when" is read here against the skill's SKILL.md text.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const TEXT = readFileSync(new URL('../plugin/skills/mega-brainstorm/SKILL.md', import.meta.url), 'utf8');

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

const flat = (text: string) => text.replace(/\s+/g, ' ');

/** Whether `phrases` appear in `text` in that order: the first one missing, or null. */
function inOrder(text: string, phrases: string[]) {
  let at = 0;
  for (const phrase of phrases) {
    const found = text.indexOf(phrase, at);
    if (found < 0) return phrase;
    at = found + phrase.length;
  }
  return null;
}

const PLAN_ONLY = flat(section(TEXT, 'Plan only'));

describe('/omni:mega-brainstorm --product <key> --plan-only <key>-<n> (PRD omni-loop-21)', () => {
  it('takes --plan-only <key>-<n> with --product, and says so in its description', () => {
    const description = /^description: (.*)$/m.exec(TEXT)?.[1] ?? '';
    expect(description).toContain('--plan-only <key>-<n>');
    expect(PLAN_ONLY).toContain('--product <key> --plan-only <key>-<n>');
    expect(inOrder(flat(TEXT), ['## From a product', '## Plan only', '## 1. Survey the targets'])).toBeNull();
  });

  it('reads the spec from the page and writes only the plan: no spec, voice or before/after change', () => {
    expect(
      inOrder(PLAN_ONLY, [
        'node .omni-loop/bin/omni.mjs prd <key>-<n>',
        'node .omni-loop/bin/omni.mjs dossier get <key>-<n> spec',
        'plan.md',
        'node .omni-loop/bin/omni.mjs dossier push <key>-<n> --from <prd folder>',
      ]),
    ).toBeNull();
    expect(PLAN_ONLY).toContain('a new plan version');
    expect(PLAN_ONLY).toContain('never changes the spec');
    for (const none of ['no survey', 'no design', 'no issue', 'no commit', 'no phase-0 PR']) expect(PLAN_ONLY).toContain(none);
  });

  it('refuses a PRD with no spec in one line, before anything is written', () => {
    const lines = section(TEXT, 'Plan only')
      .split('\n')
      .map((line) => line.trim());
    expect(lines).toContain('<key>-<n> has no spec on its page: nothing to plan');
    expect(inOrder(PLAN_ONLY, ['has no spec on its page', 'plan.md'])).toBeNull();
  });

  it('AC-3: asks nobody under OMNI_UNATTENDED, and takes the most reversible answer as an outbox item', () => {
    expect(PLAN_ONLY).toContain('`OMNI_UNATTENDED`');
    expect(PLAN_ONLY).toContain('asks nobody');
    expect(PLAN_ONLY).toContain('most reversible');
  });

  it('plans as /omni:plan does, and says omni plan check is not run on a product PRD', () => {
    expect(PLAN_ONLY).toContain('/omni:plan');
    expect(PLAN_ONLY).toContain("`omni plan check` reads a repository's PRD only");
  });
});
