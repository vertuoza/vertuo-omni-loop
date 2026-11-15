// PRD 2898, s1: an outbox item's `excuses:` field — the exact paths whose finding of the ready
// checks 4 and 5 (a loosened test, a file outside every slice's territory) the item excuses, once a
// person agreed to it (or, for check 5, once it was adopted). `omni item new --excuses <path>` writes
// it into the item's front matter, before the item is graded, so the gate reads what is written; a
// settled entry keeps it, since the ledger embeds the item's text verbatim. The field is read only as
// written: no answer's words ever widen or narrow what an item excuses (BL-ASK-1).
import { OutboxItemFrontMatterSchema } from '../schema/front-matter.ts';
import { readFrontMatterBlock } from './outbox.ts';

/** `text` with `excuses: [<paths>]` as its front matter's last field; unchanged when `paths` is empty.
 * Throws on a text with no front matter: an item always has one. */
export function withExcuses(text: string, paths: readonly string[]): string {
  if (paths.length === 0) return text;
  const lines = text.split('\n');
  const close = lines[0] === '---' ? lines.indexOf('---', 1) : -1;
  if (close === -1) throw new Error('an outbox item opens with its front matter, fenced by "---" lines');
  return [...lines.slice(0, close), `excuses: [${paths.join(', ')}]`, ...lines.slice(close)].join('\n');
}

/** The paths an item's text excuses: none when it has no `excuses:` field, or one the schema refuses. */
export function itemExcuses(text: string): string[] {
  return readFrontMatterBlock(text, null, OutboxItemFrontMatterSchema).data?.excuses ?? [];
}
