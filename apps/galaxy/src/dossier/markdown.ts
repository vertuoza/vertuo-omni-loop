// A dossier's spec and plan, rendered for /prd/<id> (PRD 216's spec, "The pages"; decision 10):
// markdown-it with raw HTML off, so HTML written in the markdown shows as text and nothing in a file
// becomes markup on the galaxy's origin. markdown-it also refuses to link a javascript:, vbscript:,
// file: or data: URL. The front matter (the block between two `---` lines that opens a spec) is not
// part of the body: it comes back as one line of text, its lines joined by ` · `, to show above it.
// The dossier renders on the server and ships the HTML. The ask page (PRD 752, decision 6) runs the
// same renderer, with the same settings, in the browser: it reads its rounds there, so it renders a
// question's lead and an option's description as one line, and the rest of a question as a body.
import MarkdownIt from 'markdown-it';
import { group } from 'vertuo-omni-plan/kit/lib/narrow.ts';

const renderer = new MarkdownIt({ html: false, linkify: false, typographer: false });

/** The front matter that opens a file: `---`, its lines, `---`. */
const FRONT = /^---\r?\n([\s\S]*?)\r?\n?---[ \t]*(?:\r?\n|$)/;

export type RenderedMarkdown = {
  /** The front matter as one line of text (`prd: 216 · title: …`), or null when the file has none. */
  front: string | null;
  /** The body as HTML, raw HTML in it escaped. */
  html: string;
};

export function renderMarkdown(text: string): RenderedMarkdown {
  const match = FRONT.exec(text);
  const lines = match ? group(match, 1).split(/\r?\n/).map((line) => line.trim()).filter(Boolean) : [];
  const body = match ? text.slice(match[0].length) : text;
  return { front: lines.length ? lines.join(' · ') : null, html: renderer.render(body) };
}

/** One line as HTML, with no paragraph around it: code, emphasis and links, raw HTML escaped. */
export function renderInlineMarkdown(text: string): string {
  return renderer.renderInline(text);
}

/** A body as HTML, with no front matter taken out: a question's text can open with `---`. */
export function renderMarkdownBody(text: string): string {
  return renderer.render(text);
}
