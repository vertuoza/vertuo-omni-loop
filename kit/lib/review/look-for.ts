/**
 * **What the Reviewer looks for** (PRD 2871, s1): the `review` form's `look-for` section, read as a
 * list. The kit's default holds six items in order of harm (correctness, security and data, tests
 * that prove it, scope, laws and conventions, design and complexity); a repository extends it in its
 * own `look-for` section and never shortens it.
 *
 * So the list is always the kit default's items, in order, then each list item of the section the
 * repository resolves to (its own, or the nearest level of the knowledge tree's), in its order. An
 * added item that repeats a default one (the same words, whatever its spacing, case or list mark) is
 * dropped, and prose around the items is no item: a section that holds no list item adds nothing.
 * `omni kb show review` prints the section as every section prints; `omni review look-for` prints
 * this list.
 */
import type { Context } from '../context.ts';
import { parseForm } from '../playbook/forms.ts';
import { resolveForm } from '../playbook/resolve.ts';
import { formTemplate } from '../playbook/templates.ts';

/** The slot of the `review` form that holds what to look for. */
const SLOT = 'look-for';

/** One thing to look for, and where it came from: `kit` for the default, else the section's source. */
export type LookForItem = { text: string; source: string };

const ITEM = /^(?:[-*+]|\d+[.)])\s+(.*\S)\s*$/;
const CONTINUED = /^\s+(\S.*?)\s*$/;

/** Each top-level list item of `text`, a wrapped one joined into one line. */
function listItems(text: string): string[] {
  const items: string[] = [];
  let open = false;
  for (const raw of text.split('\n')) {
    const item = ITEM.exec(raw);
    const continued = CONTINUED.exec(raw);
    if (item?.[1] !== undefined) {
      items.push(item[1]);
      open = true;
    } else if (open && continued?.[1] !== undefined) {
      items[items.length - 1] = `${items.at(-1) ?? ''} ${continued[1]}`;
    } else {
      open = false;
    }
  }
  return items;
}

/** An item's words, for telling a repeat: no emphasis or code marks, one space, lower case. */
const wordsOf = (text: string): string => text.replace(/[*_`]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();

/**
 * The items of `kitText` (the kit default's section), then those of `own` (the section the
 * repository resolved to, `null` when it fell through to the default) that repeat none before them.
 */
export function lookForItems(kitText: string, own: { text: string; source: string } | null): LookForItem[] {
  const items: LookForItem[] = listItems(kitText).map((text) => ({ text, source: 'kit' }));
  if (!own) return items;
  const seen = new Set(items.map(({ text }) => wordsOf(text)));
  for (const text of listItems(own.text)) {
    const words = wordsOf(text);
    if (seen.has(words)) continue;
    seen.add(words);
    items.push({ text, source: own.source });
  }
  return items;
}

/** What the Reviewer looks for in the repository at `ctx`: the kit default's six, then what it adds. */
export function lookFor({ ctx }: { ctx: Pick<Context, 'root' | 'layout' | 'config'> }): LookForItem[] {
  const template = formTemplate('review');
  const kit = parseForm(template).form?.slots.find((slot) => slot.id === SLOT);
  const section = resolveForm('review', { ctx, template }).sections.find((entry) => entry.slot === SLOT);
  const own = section && section.source !== 'kit' ? { text: section.text, source: section.source } : null;
  return lookForItems(kit?.body.text ?? '', own);
}
