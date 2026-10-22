// The playbook as one line per rule, for a judge that must tell a new lesson from a known one: the
// retro's (apps/omni-app/src/retro/narrate.ts). A retro once kept "re-date a migration after main
// moves on" as new, "stated nowhere", while `conventions.md` stated it, because the judge was given
// the registers and the ADRs but never the playbook (#2207).
//
// A rule is a top-level bullet of a filled slot, or a paragraph of one with no bullets. Its line is a
// bold headline with the sentence after it (`**A migration stays the newest until it merges.**
// `supabase db push` refuses…`), else its first sentence, on one line and at most LINE_MAX
// characters. A table, a code block or a quote is no rule. Each line's id is the slot it sits in,
// `playbook/<form>#<slot>`, the id a settled entry's `Became:` names. Nothing here throws: a form
// missing or unreadable gives no line.
import type { Context } from '../context.ts';
import { FORM_IDS, type Form, readForm } from './forms.ts';

export const LINE_MAX = 240;

export type PlaybookLine = { id: string; line: string };

const BOLD_HEAD = /^\*\*(.+?)\*\*\s*/;
const NOT_PROSE = /^[|`#>]/;

/** Up to the end of its first sentence: a full stop, `?` or `!` followed by a space, else all of it. */
function firstSentence(text: string): string {
  const end = text.search(/[.?!]\s/);
  return end === -1 ? text : text.slice(0, end + 1);
}

function lineOf(item: string): string {
  const flat = item.replace(/\s+/g, ' ').trim();
  const bold = BOLD_HEAD.exec(flat);
  const line = bold ? `${bold[1] ?? ''} ${firstSentence(flat.slice(bold[0].length))}`.trim() : firstSentence(flat);
  return line.length > LINE_MAX ? `${line.slice(0, LINE_MAX - 1)}…` : line;
}

/** A paragraph's rules: each top-level bullet, which runs until the next one, else the paragraph. */
function rulesOf(paragraph: string): string[] {
  const rows = paragraph.split('\n');
  const starts = rows.flatMap((row, at) => (/^[-*] /.test(row) ? [at] : []));
  const items = starts.length > 0 ? starts.map((at, k) => rows.slice(at, starts[k + 1]).join(' ').slice(2)) : [paragraph];
  return items.filter((item) => !NOT_PROSE.test(item.trim())).map(lineOf).filter(Boolean);
}

/** The rules of one parsed form, one line each, in file order. */
export function formLines(form: Form): PlaybookLine[] {
  return form.slots.flatMap((slot) => {
    if (slot.body.kind !== 'text') return [];
    const id = `playbook/${form.id}#${slot.id}`;
    return slot.body.text.split(/\n\s*\n/).flatMap(rulesOf).map((line) => ({ id, line }));
  });
}

/** Every form of the kit that the repository's playbook holds and that reads, as its rule lines. */
export function playbookLines({ ctx }: { ctx: Pick<Context, 'root' | 'layout'> }): PlaybookLine[] {
  return FORM_IDS.flatMap((id) => {
    const read = readForm(id, { ctx });
    return read.exists && read.ok ? formLines(read.form) : [];
  });
}
