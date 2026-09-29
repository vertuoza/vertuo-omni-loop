import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';

// PRD 476: on every page drawn in Ask's colours, what the eye must find (a chip, a badge, a card or
// panel, a control, a tab) is outlined with --ask-line-strong, at 3:1 against what it sits on.
// --ask-line stays for the borders that only divide content. The dossier page's stylesheet is
// graded by its own test (src/dossier/page/page.test.ts).

const SRC = fileURLToPath(new URL('..', import.meta.url));
const FOLDERS = ['ask', 'nav', 'dashboard', 'docs', 'fleets', 'knowledge', 'releases', 'switch'];

function stylesheets(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return stylesheets(path);
    return entry.name.endsWith('.css') ? [path] : [];
  });
}

/** Every innermost rule of every stylesheet in the folders, as its file, selector and declarations. */
const RULES = FOLDERS.flatMap((folder) => stylesheets(join(SRC, folder))).flatMap((path) => {
  const css = readFileSync(path, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  const file = relative(SRC, path);
  return [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({
    file,
    selector: m[1].trim().split('\n').pop()!.trim(),
    body: m[2],
  }));
});

/** The borders that only divide content: a bar's edge, a rule between rows, a table cell, an hr. */
const DIVIDERS = new Set([
  'ask/ask.css .ask-bar',
  'ask/ask.css .ask-q + .ask-q',
  'ask/ask.css .ask-history',
  'nav/user-menu.css .user-menu-who',
  'nav/sidebar.css .app-sidebar',
  'nav/sidebar.css .app-shell > .app-sidebar',
  'nav/sidebar.css .app-shell > .app-sidebar[data-open]',
  'nav/sidebar.css .app-sidebar-foot',
  'dashboard/week/week.css .dash-week-grid',
  'dashboard/rankings/rankings.css .dash-rank-table tbody td',
  'dashboard/board/board.css .board-grid',
  'dashboard/board/board.css .board-table td',
  'docs/docs.css .docs-md h2',
  'docs/docs.css .docs-md blockquote',
  'docs/docs.css .docs-md hr',
  'docs/docs.css .docs-md td',
  'docs/docs.css .docs-md > p:last-child:has(> a:only-child)',
  'docs/docs.css .docs-toc ol',
  'knowledge/knowledge.css .km-ring',
  'releases/page/releases.css .rel-week',
  'releases/page/releases.css .rel-line',
]);

/** What may be see-through: never text, only a hidden input, a scrim, a backdrop or a drawing. */
const SEE_THROUGH = new Set([
  'ask/ask.css .ask-opt input',
  'nav/drawer.css .app-drawer-scrim',
  'switch/switch.css .ask .game-mode-dialog::backdrop',
  "switch/switch.css .ask[data-ask-theme='dark'] .game-mode-dialog::backdrop",
  'fleets/fleets.css .fleets-mascot input',
  'dashboard/week/week.css .dash-week-day:hover .dash-week-bar',
  'knowledge/knowledge.css .km-link',
  'knowledge/knowledge.css .km-pick.is-dim',
]);

describe("outlines on Ask's pages (PRD 476)", () => {
  it('finds the stylesheets it grades', () => {
    expect(RULES.length).toBeGreaterThan(100);
    for (const key of [...DIVIDERS, ...SEE_THROUGH]) {
      expect(RULES.some((r) => `${r.file} ${r.selector}` === key), key).toBe(true);
    }
  });

  it('outlines chips, badges, cards, controls and tabs with --ask-line-strong; only dividers keep --ask-line', () => {
    const weak = RULES.filter((r) => /var\(--ask-line\)/.test(r.body) && !DIVIDERS.has(`${r.file} ${r.selector}`))
      .map((r) => `${r.file} ${r.selector}`);
    expect(weak).toEqual([]);
  });

  it('keeps the dividers quiet: none of them is drawn with --ask-line-strong', () => {
    const loud = RULES.filter((r) => DIVIDERS.has(`${r.file} ${r.selector}`) && r.body.includes('--ask-line-strong'))
      .map((r) => `${r.file} ${r.selector}`);
    expect(loud).toEqual([]);
  });

  it('dims no text with opacity', () => {
    const dimmed = RULES.filter((r) => {
      const values = [...r.body.matchAll(/(?:^|[;\s])opacity:\s*([\d.]+)/g)].map((m) => Number(m[1]));
      return values.some((v) => v < 1) && !SEE_THROUGH.has(`${r.file} ${r.selector}`);
    }).map((r) => `${r.file} ${r.selector}`);
    expect(dimmed).toEqual([]);
  });
});
