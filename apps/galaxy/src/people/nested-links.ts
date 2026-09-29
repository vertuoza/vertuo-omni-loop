// PRD 698: a chip is a link, so a chip drawn inside another link must stay plain. This counts, in
// rendered markup, every <a> opened while another <a> is still open: the render tests of each screen
// that draws a chip inside a link expect none.

/** How many links open inside another link in this markup. */
export function nestedLinks(html: string): number {
  let depth = 0;
  let nested = 0;
  for (const [tag] of html.matchAll(/<\/?a\b[^>]*>/gi)) {
    if (tag.startsWith('</')) depth = Math.max(0, depth - 1);
    else {
      if (depth > 0) nested += 1;
      depth += 1;
    }
  }
  return nested;
}
