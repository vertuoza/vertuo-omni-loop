import { describe, it, expect } from 'vitest';
import { renderInlineMarkdown, renderMarkdown, renderMarkdownBody } from './markdown';

// A dossier's spec and plan, as /prd/<id> shows them (PRD 216): markdown rendered by markdown-it with
// raw HTML off, and the front matter as one line above the body.

describe('rendering a spec or a plan', () => {
  it('renders the markdown a spec is written in: headings, lists, tables, code', () => {
    const { html } = renderMarkdown([
      '# Team inbox',
      '',
      'A **shared** inbox, with `code`.',
      '',
      '- one',
      '- two',
      '',
      '| id | slice |',
      '| --- | --- |',
      '| s1 | the tables |',
      '',
      '```sql',
      'select 1;',
      '```',
    ].join('\n'));
    expect(html).toContain('<h1>Team inbox</h1>');
    expect(html).toContain('<strong>shared</strong>');
    expect(html).toContain('<code>code</code>');
    expect(html).toContain('<li>one</li>');
    expect(html).toContain('<table>');
    expect(html).toContain('<td>s1</td>');
    expect(html).toContain('<pre><code class="language-sql">select 1;\n</code></pre>');
  });

  it('shows raw HTML as text, never as markup', () => {
    const { html } = renderMarkdown('Before <script>alert(1)</script> after\n\n<img src=x onerror=alert(1)>\n\n<div class="x">block</div>');
    expect(html).not.toContain('<script');
    expect(html).not.toContain('<img');
    expect(html).not.toContain('<div');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
    expect(html).toContain('&lt;div class=&quot;x&quot;&gt;block&lt;/div&gt;');
  });

  it('never links a script: URL', () => {
    const { html } = renderMarkdown('[click](javascript:alert(1)) and [safe](https://example.com/a)');
    expect(html).not.toMatch(/href="javascript:/i);
    expect(html).toContain('<a href="https://example.com/a">safe</a>');
  });

  it('takes the front matter out of the body and gives it back as one line', () => {
    const { front, html } = renderMarkdown('---\nprd: 216\ntitle: PRD dossiers\nblocked-by: [144]\nspec: file\n---\n\n# PRD dossiers\n');
    expect(front).toBe('prd: 216 · title: PRD dossiers · blocked-by: [144] · spec: file');
    expect(html).toBe('<h1>PRD dossiers</h1>\n');
    expect(html).not.toContain('prd: 216');
  });

  it('reads front matter written with Windows line ends', () => {
    expect(renderMarkdown('---\r\nprd: 7\r\n---\r\n# Seven').front).toBe('prd: 7');
  });

  it('has no front matter line when the file has none, or does not open with it', () => {
    expect(renderMarkdown('# Plan: team inbox\n').front).toBeNull();
    expect(renderMarkdown('# Plan\n\n---\nnot: front\n---\n').front).toBeNull();
    expect(renderMarkdown('---\n---\n# Empty').front).toBeNull();
  });

  it('escapes what the front matter says too: it is text', () => {
    expect(renderMarkdown('---\ntitle: <b>bold</b>\n---\n').front).toBe('title: <b>bold</b>');
  });
});

// The ask page renders questions and option descriptions with the same renderer, in the browser
// (PRD 752, decision 6): a lead or a description as one line, the rest of a question as a body.
describe('rendering a line of a question', () => {
  it('renders code and emphasis without wrapping the line in a paragraph', () => {
    expect(renderInlineMarkdown('Open `libs/vertuo-workflow-ui/README.md` **now**')).toBe(
      'Open <code>libs/vertuo-workflow-ui/README.md</code> <strong>now</strong>',
    );
  });

  it('shows raw HTML as text, and never links a script: URL', () => {
    expect(renderInlineMarkdown('<b>x</b>')).toBe('&lt;b&gt;x&lt;/b&gt;');
    expect(renderInlineMarkdown('[go](javascript:alert(1))')).not.toMatch(/href="javascript:/i);
  });

  it('leaves plain text as it is', () => {
    expect(renderInlineMarkdown('Row-level security per owner.')).toBe('Row-level security per owner.');
  });

  it('renders the rest of a question as a body, its steps as a numbered list, nothing taken as front matter', () => {
    const html = renderMarkdownBody('Steps:\n\n1. open `vertuo-apps`\n2. merge <b>it</b>');
    expect(html).toBe('<p>Steps:</p>\n<ol>\n<li>open <code>vertuo-apps</code></li>\n<li>merge &lt;b&gt;it&lt;/b&gt;</li>\n</ol>\n');
    expect(renderMarkdownBody('---\nnot: front\n---\n')).toContain('not: front');
  });
});
