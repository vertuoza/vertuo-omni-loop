// `guard`: the model's JSON and the fact sheet in, the prose `render` may write out (PRD 72, decision
// 5). Pure. Slice s6 builds the checks: a field is dropped, with its reason, when it holds a digit
// (outside backtick spans copied from the evidence), names a finding id `detect` did not produce,
// carries a link that is not an evidence URL, is longer than its cap in `rules`, or holds a word
// `rules` refuses.
//
// Until then it accepts nothing: with no reply there is no prose, and a reply is not trusted yet.
//
// The contract `render` relies on:
//   out: { prose: Prose | null, dropped: [{ field, reason }] }
//   Prose: { summary?: Field, findings: { [id]: { title?: Field, whyItMatters?: Field, lesson?: Field } },
//            lessons: [{ text: string, findings: [id] }] }
//   Field: a string, or `{ dropped: '<reason>' }` for a field refused, which `render` writes as one
//          line naming the reason.

/**
 * @param {{ reply: object | null, sheet: object }} input
 * @returns {{ prose: object | null, dropped: { field: string, reason: string }[] }}
 */
export function guard({ reply }) {
  if (!reply) return { prose: null, dropped: [] };
  return { prose: null, dropped: [{ field: 'reply', reason: 'not checked yet' }] };
}
