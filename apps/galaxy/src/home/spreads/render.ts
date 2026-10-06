import type { ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { at, group } from 'vertuo-omni-plan/kit/lib/narrow.ts';

// What the spreads' tests share: a spread rendered as the server renders it, and the text a visitor
// reads in it, with scripts and tags left out.

export const html = (spread: ReactElement) => renderToStaticMarkup(spread);

export const text = (markup: string) => markup.replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
  .replace(/&#x27;/g, '\'').replace(/&quot;/g, '"').replace(/&amp;/g, '&');

/** The text of the spread's one `h2`. */
export const heading = (markup: string) => {
  const heads = [...markup.matchAll(/<h2\b[^>]*>([\s\S]*?)<\/h2>/g)];
  if (heads.length !== 1) throw new Error(`expected one h2, found ${heads.length}`);
  return text(group(at(heads, 0, 'the h2'), 1));
};
