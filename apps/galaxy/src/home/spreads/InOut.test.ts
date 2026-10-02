import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { InOut } from './InOut';
import { heading, html, text } from './render';

/** The `h3` column opened by `title`: everything from its heading to the column's end. */
const column = (markup: string, title: string) => {
  const found = [...markup.matchAll(/<div class="home-inout-col">([\s\S]*?)<\/div>/g)]
    .map(([, body]) => body)
    .find((body) => new RegExp(`<h3\\b[^>]*>${title}</h3>`).test(body!));
  if (!found) throw new Error(`no column headed ${title}`);
  return found;
};

const items = (markup: string) => [...markup.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/g)].map(([, li]) => li!);

describe('Easy in, easy out', () => {
  it('opens on its own h2', () => {
    expect(heading(html(InOut()))).toBe('Easy in, easy out');
  });

  it('gets in in four numbered steps, in order, each command in <code>', () => {
    const getIn = column(html(InOut()), 'GET IN');
    expect(getIn).toMatch(/<ol\b/);
    const steps = items(getIn);
    expect(steps.map(text)).toEqual([
      'omni init adds one folder to your repository, .omni-loop/ , and a status line to .claude/settings.json .',
      'Install the omni plugin in Claude Code, and the omni-loop GitHub App.',
      '/omni:invade writes your harness from what your repository already proves. You merge it as one pull request of docs.',
      '/omni:brainstorm your first feature.',
    ]);
    expect(steps[0]).toContain('<code>omni init</code>');
    expect(steps[0]).toContain('<code>.omni-loop/</code>');
    expect(steps[0]).toContain('<code>.claude/settings.json</code>');
    expect(steps[2]).toContain('<code>/omni:invade</code>');
    expect(steps[3]).toContain('<code>/omni:brainstorm</code>');
  });

  it('gets out by deleting the folder and the status line, with the fine print about the labels and the App', () => {
    const getOut = column(html(InOut()), 'GET OUT');
    const lines = items(getOut);
    expect(lines.map(text)).toEqual([
      'Delete .omni-loop/ and the statusLine in .claude/settings.json , and commit. That\'s it.',
      'Everything the agents shipped is ordinary code, ordinary pull requests and git history. Nothing to migrate.',
    ]);
    expect(lines[0]).toContain('<code>.omni-loop/</code>');
    expect(lines[0]).toContain('<code>statusLine</code>');
    expect(lines[0]).toContain('<code>.claude/settings.json</code>');
    expect(lines[0]).toMatch(/^<(b|strong)>[\s\S]*<\/(b|strong)>$/);
    expect(getOut).toMatch(/<p class="home-fine">The GitHub labels and the App installation stay until you remove them\.<\/p>/);
  });

  it('puts GET IN before GET OUT, and holds no link', () => {
    const markup = html(InOut());
    expect(markup.indexOf('>GET IN</h3>')).toBeGreaterThan(-1);
    expect(markup.indexOf('>GET IN</h3>')).toBeLessThan(markup.indexOf('>GET OUT</h3>'));
    expect(markup).not.toMatch(/<a\b/);
  });

  it('sets its two columns side by side, stacked under 760 px', () => {
    const css = readFileSync(new URL('./InOut.css', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    expect(css).toMatch(/\.home-inout\s*\{[^}]*grid-template-columns:\s*repeat\(2,/);
    expect(css).toMatch(/@media \(max-width: 760px\)\s*\{\s*\.home-inout\s*\{\s*grid-template-columns:\s*1fr;/);
  });
});
