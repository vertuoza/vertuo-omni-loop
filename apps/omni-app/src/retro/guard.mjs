// `guard`: the model's JSON and the fact sheet in, the prose `render` may write out (PRD 72, decision
// 5, "The model, and the guard"). Pure: the same reply and sheet always give the same prose.
//
// Each field is checked on its own and kept, or dropped with its reason, when it:
//   - is not text, or is longer than its cap in `rules` (`FIELD_CAPS`; a lesson of the list is capped
//     like a finding's lesson);
//   - holds a word `rules` refuses;
//   - carries a link that is not one of the evidence URLs;
//   - names a finding id `detect` did not produce (and a lesson citing none is dropped too);
//   - holds a digit, once set aside: the backtick spans copied verbatim from the evidence (its labels,
//     URLs and excerpts, and the finding ids) that hold a letter, and the evidence URLs themselves.
//     A bare number in backticks is still a number, so it is never set aside.
// A field breaking several rules is dropped for the first of them, in that order. The reasons are
// fixed sentences: they never repeat the text refused, so no refused word or number reaches the retro
// through them.
//
// The contract `render` relies on:
//   out: { prose: Prose | null, dropped: [{ field, reason }] }
//   Prose: { summary?: Field, findings: { [id]: { title?: Field, whyItMatters?: Field, lesson?: Field } },
//            lessons: [{ text: string, findings: [id] }] }
//   Field: a string, or `{ dropped: '<reason>' }` for a field refused, which `render` writes as one
//          line naming the reason. A lesson of the list has no such form, so a refused one keeps its
//          place as that same line (`_Dropped: <reason>._`), citing only the findings the retro found.
import { FIELD_CAPS, FINDING_ORDER, refusedWordsIn } from './rules.mjs';

/** Why a field was dropped, as `render` writes it after "Dropped: ". */
export const DROPPED = Object.freeze({
  notText: 'it is not text',
  tooLong: 'it is longer than the rules allow',
  refusedWord: 'it holds a word the rules refuse',
  foreignLink: 'it carries a link that is not evidence',
  unknownFinding: 'it names a finding the retro did not find',
  noFinding: 'it cites no finding',
  digit: 'it holds a digit',
});

const FINDING_FIELDS = Object.freeze(['title', 'whyItMatters', 'lesson']);

/** A finding id as `detect` builds them: a kind `rules` ranks, a colon, then what was found. */
const FINDING_ID = new RegExp(`(?<![\\w-])(?:${FINDING_ORDER.flat().map(escape).join('|')}):[^\\s\`'"()<>\\[\\],;]+`, 'g');
const LINK = /\bhttps?:\/\/[^\s<>()[\]`'"]+/gi;
const BACKTICK_SPAN = /`([^`\n]+)`/g;
const TRAILING = /[.,;:!?]+$/;

/**
 * @param {{ reply: object | null, sheet: { findings?: object[] } }} input
 * @returns {{ prose: object | null, dropped: { field: string, reason: string }[] }}
 */
export function guard({ reply, sheet }) {
  if (!reply) return { prose: null, dropped: [] };
  const evidence = evidenceOf(sheet);
  const dropped = [];
  const check = (field, value, cap) => {
    const reason = refusal(value, cap, evidence);
    if (!reason) return value;
    dropped.push({ field, reason });
    return { dropped: reason };
  };

  const prose = { findings: {}, lessons: [] };
  if (reply.summary !== undefined) prose.summary = check('summary', reply.summary, FIELD_CAPS.summary);

  const given = isObject(reply.findings) ? reply.findings : {};
  let unknown = false;
  for (const [id, words] of Object.entries(given)) {
    if (!evidence.ids.has(id)) {
      unknown = true;
      continue;
    }
    const kept = {};
    for (const name of FINDING_FIELDS) {
      const value = isObject(words) ? words[name] : undefined;
      if (value !== undefined) kept[name] = check(`findings.${id}.${name}`, value, FIELD_CAPS[name]);
    }
    prose.findings[id] = kept;
  }
  if (unknown) dropped.push({ field: 'findings', reason: DROPPED.unknownFinding });

  const lessons = Array.isArray(reply.lessons) ? reply.lessons : [];
  lessons.forEach((lesson, index) => {
    const cited = Array.isArray(lesson?.findings) ? lesson.findings : [];
    const known = cited.filter((id) => evidence.ids.has(id));
    const reason =
      refusal(lesson?.text, FIELD_CAPS.lesson, evidence) ??
      (cited.length === 0 ? DROPPED.noFinding : known.length < cited.length ? DROPPED.unknownFinding : null);
    if (!reason) {
      prose.lessons.push({ text: lesson.text, findings: [...cited] });
      return;
    }
    dropped.push({ field: `lessons.${index}`, reason });
    prose.lessons.push({ text: `_Dropped: ${reason}._`, findings: known });
  });

  return { prose, dropped };
}

/** Why a field is refused, or `null` when it is kept. */
function refusal(value, cap, evidence) {
  if (typeof value !== 'string') return DROPPED.notText;
  if (value.length > cap) return DROPPED.tooLong;
  if (refusedWordsIn(value).length > 0) return DROPPED.refusedWord;
  const links = linksIn(value);
  if (links.some((link) => !evidence.urls.has(link))) return DROPPED.foreignLink;
  if (findingIdsIn(value).some((id) => !evidence.ids.has(id))) return DROPPED.unknownFinding;
  if (/\d/.test(setAside(value, evidence))) return DROPPED.digit;
  return null;
}

/** The text with the verbatim evidence spans and the evidence links taken out. */
function setAside(text, evidence) {
  const spans = text.replace(BACKTICK_SPAN, (span, inner) => (/\p{L}/u.test(inner) && evidence.holds(inner) ? ' ' : span));
  return spans.replace(LINK, (link) => (evidence.urls.has(link.replace(TRAILING, '')) ? ' ' : link));
}

function linksIn(text) {
  return (text.match(LINK) ?? []).map((link) => link.replace(TRAILING, ''));
}

function findingIdsIn(text) {
  return (text.match(FINDING_ID) ?? []).map((id) => id.replace(TRAILING, ''));
}

/** What the model was given as evidence: the finding ids, the evidence URLs, and every text it may copy. */
function evidenceOf(sheet) {
  const findings = Array.isArray(sheet?.findings) ? sheet.findings : [];
  const ids = new Set(findings.map((finding) => finding.id));
  const urls = new Set();
  const texts = [...ids];
  for (const finding of findings) {
    for (const item of finding.evidence ?? []) {
      if (typeof item?.url === 'string') urls.add(item.url);
      for (const text of [item?.label, item?.url, item?.excerpt]) if (typeof text === 'string') texts.push(text);
    }
  }
  return { ids, urls, holds: (span) => texts.some((text) => text.includes(span)) };
}

function isObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function escape(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
