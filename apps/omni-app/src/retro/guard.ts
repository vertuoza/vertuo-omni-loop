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
// A field breaking several rules is dropped for the first of them, in that order.
//
// The judge's verdict (PRD 487) is checked as one: `worthIt` true or false, `reason` a field like any
// other (capped at `FIELD_CAPS.reason`), each finding's `keep` true or false and its `why` a field
// capped at `FIELD_CAPS.why`, except that `reason` and `why` may hold digits: they only explain the
// verdict, and naming a slice or a count is how a model says why, and a verdict worth it keeping at least one finding the retro found
// with a lesson it kept. A kept finding without a kept lesson drops it too. A verdict failing any of
// these is dropped whole, for its first failure, and every `keep` and `why` with it: the retro is
// then **not judged**. The reasons are
// fixed sentences: they never repeat the text refused, so no refused word or number reaches the retro
// through them.
//
// The contract `render` relies on:
//   out: { prose: Prose | null, dropped: [{ field, reason }] }
//   Prose: { summary?: Field, findings: { [id]: { title?: Field, whyItMatters?: Field, lesson?: Field,
//                                                 keep?: boolean, why?: string } },
//            lessons: [{ text: string, findings: [id] }],
//            verdict: { worthIt: boolean, reason: string } | { dropped: '<reason>' } }
//          `keep` and `why` are only there when the verdict is: a dropped verdict keeps no finding.
//   Field: a string, or `{ dropped: '<reason>' }` for a field refused, which `render` writes as one
//          line naming the reason. A lesson of the list has no such form, so a refused one keeps its
//          place as that same line (`_Dropped: <reason>._`), citing only the findings the retro found.
import { isList } from 'vertuo-omni-plan/kit/lib/outbox/plain-text.ts';
import { FIELD_CAPS, FINDING_ORDER, refusedWordsIn } from './rules.ts';
import type { Dropped, Prose, ProseField, ProseFinding, Verdict } from './retro.types.ts';

/** A field dropped, and why. */
export type DroppedField = { field: string; reason: string };

/** What `guard` reads of the fact sheet: each finding's id and its evidence, an item of which may be missing. */
export type GuardSheet = {
  findings?: readonly { id: string; evidence?: readonly ({ label?: unknown; url?: unknown; excerpt?: unknown } | null)[] | null }[];
} | null;

type Evidence = { ids: Set<string>; urls: Set<string>; holds: (span: string) => boolean };
type Reply = Record<string, unknown>;

/** Why a field was dropped, as `render` writes it after "Dropped: ". */
export const DROPPED = Object.freeze({
  notText: 'it is not text',
  tooLong: 'it is longer than the rules allow',
  refusedWord: 'it holds a word the rules refuse',
  foreignLink: 'it carries a link that is not evidence',
  unknownFinding: 'it names a finding the retro did not find',
  noFinding: 'it cites no finding',
  digit: 'it holds a digit',
  noVerdict: 'it gives no verdict',
  notYesOrNo: 'it is not true or false',
  nothingKept: 'it is worth a pull request but keeps no finding',
  keptNoLesson: 'it keeps a finding with no lesson',
});

const FINDING_FIELDS = Object.freeze(['title', 'whyItMatters', 'lesson'] as const);

/** A finding id as `detect` builds them: a kind `rules` ranks, a colon, then what was found. */
const FINDING_ID = new RegExp(`(?<![\\w-])(?:${FINDING_ORDER.flat().map(escape).join('|')}):[^\\s\`'"()<>\\[\\],;]+`, 'g');
const LINK = /\bhttps?:\/\/[^\s<>()[\]`'"]+/gi;
const BACKTICK_SPAN = /`([^`\n]+)`/g;
const TRAILING = /[.,;:!?]+$/;

/** `reply` is the model's JSON, whatever it holds; a non-object reply is read as one with no field. */
export function guard({ reply, sheet }: { reply: unknown; sheet: GuardSheet }): { prose: Prose | null; dropped: DroppedField[] } {
  if (!reply) return { prose: null, dropped: [] };
  const given: Reply = isObject(reply) ? reply : {};
  const evidence = evidenceOf(sheet);
  const dropped: DroppedField[] = [];
  const check = (field: string, value: unknown, cap: number): ProseField => {
    const reason = refusal(value, cap, evidence);
    if (reason === null && typeof value === 'string') return value;
    const why = reason ?? DROPPED.notText;
    dropped.push({ field, reason: why });
    return { dropped: why };
  };

  const prose: Prose = { findings: {}, lessons: [] };
  if (given.summary !== undefined) prose.summary = check('summary', given.summary, FIELD_CAPS.summary);

  const findings = isObject(given.findings) ? given.findings : {};
  let unknown = false;
  for (const [id, words] of Object.entries(findings)) {
    if (!evidence.ids.has(id)) {
      unknown = true;
      continue;
    }
    const kept: ProseFinding = {};
    for (const name of FINDING_FIELDS) {
      const value = isObject(words) ? words[name] : undefined;
      if (value !== undefined) kept[name] = check(`findings.${id}.${name}`, value, FIELD_CAPS[name]);
    }
    prose.findings[id] = kept;
  }
  if (unknown) dropped.push({ field: 'findings', reason: DROPPED.unknownFinding });

  const lessons: unknown[] = Array.isArray(given.lessons) ? given.lessons : [];
  lessons.forEach((lesson, index) => {
    const entry: Reply = isObject(lesson) ? lesson : {};
    const cited: unknown[] = Array.isArray(entry.findings) ? entry.findings : [];
    const known = cited.filter((id): id is string => typeof id === 'string' && evidence.ids.has(id));
    const reason =
      refusal(entry.text, FIELD_CAPS.lesson, evidence) ??
      (cited.length === 0 ? DROPPED.noFinding : known.length < cited.length ? DROPPED.unknownFinding : null);
    if (reason === null && typeof entry.text === 'string') {
      prose.lessons.push({ text: entry.text, findings: [...known] });
      return;
    }
    const why = reason ?? DROPPED.notText;
    dropped.push({ field: `lessons.${index}`, reason: why });
    prose.lessons.push({ text: `_Dropped: ${why}._`, findings: known });
  });

  prose.verdict = judge(given, findings, prose, evidence, dropped);
  return { prose, dropped };
}

/**
 * The verdict `guard` keeps, with each finding's `keep` and `why` written into `prose.findings`; or
 * `{ dropped }` for the first check it fails, the failure pushed onto `dropped`.
 */
function judge(reply: Reply, findings: Reply, prose: Prose, evidence: Evidence, dropped: DroppedField[]): Verdict {
  const failed = (field: string, reason: string): Dropped => {
    dropped.push({ field, reason });
    return { dropped: reason };
  };
  const verdict = reply.verdict;
  if (!isObject(verdict)) return failed('verdict', DROPPED.noVerdict);
  if (typeof verdict.worthIt !== 'boolean') return failed('verdict.worthIt', DROPPED.notYesOrNo);
  const reasonRefused = refusal(verdict.reason, FIELD_CAPS.reason, evidence, VERDICT_WORDS);
  if (reasonRefused !== null || typeof verdict.reason !== 'string') return failed('verdict.reason', reasonRefused ?? DROPPED.notText);
  const reason = verdict.reason;

  const judged: Record<string, Pick<ProseFinding, 'keep' | 'why'>> = {};
  let keptOne = false;
  for (const [id, kept] of Object.entries(prose.findings)) {
    // Only an id whose words are an object is in `prose.findings`.
    const given = findings[id];
    const words: Reply = isObject(given) ? given : {};
    const field = `findings.${id}`;
    const marks: Pick<ProseFinding, 'keep' | 'why'> = {};
    if (words.keep !== undefined) {
      if (typeof words.keep !== 'boolean') return failed(`${field}.keep`, DROPPED.notYesOrNo);
      marks.keep = words.keep;
    }
    if (words.why !== undefined) {
      const whyRefused = refusal(words.why, FIELD_CAPS.why, evidence, VERDICT_WORDS);
      if (whyRefused !== null || typeof words.why !== 'string') return failed(`${field}.why`, whyRefused ?? DROPPED.notText);
      marks.why = words.why;
    }
    if (marks.keep) {
      if (typeof kept.lesson !== 'string') return failed(`${field}.keep`, DROPPED.keptNoLesson);
      keptOne = true;
    }
    judged[id] = marks;
  }
  if (verdict.worthIt && !keptOne) return failed('verdict', DROPPED.nothingKept);

  for (const [id, marks] of Object.entries(judged)) Object.assign(prose.findings[id] ?? {}, marks);
  return { worthIt: verdict.worthIt, reason };
}

/** The verdict's own words, its `reason` and each `why`, may hold digits. */
const VERDICT_WORDS = Object.freeze({ digits: true });

/** Why a field is refused, or `null` when it is kept. */
function refusal(value: unknown, cap: number, evidence: Evidence, { digits = false } = {}): string | null {
  if (typeof value !== 'string') return DROPPED.notText;
  if (value.length > cap) return DROPPED.tooLong;
  if (refusedWordsIn(value).length > 0) return DROPPED.refusedWord;
  const links = linksIn(value);
  if (links.some((link) => !evidence.urls.has(link))) return DROPPED.foreignLink;
  if (findingIdsIn(value).some((id) => !evidence.ids.has(id))) return DROPPED.unknownFinding;
  if (!digits && /\d/.test(setAside(value, evidence))) return DROPPED.digit;
  return null;
}

/** The text with the verbatim evidence spans and the evidence links taken out. */
function setAside(text: string, evidence: Evidence): string {
  const spans = text.replace(BACKTICK_SPAN, (span, inner: string) => (/\p{L}/u.test(inner) && evidence.holds(inner) ? ' ' : span));
  return spans.replace(LINK, (link) => (evidence.urls.has(link.replace(TRAILING, '')) ? ' ' : link));
}

function linksIn(text: string): string[] {
  return (text.match(LINK) ?? []).map((link) => link.replace(TRAILING, ''));
}

function findingIdsIn(text: string): string[] {
  return (text.match(FINDING_ID) ?? []).map((id) => id.replace(TRAILING, ''));
}

/** What the model was given as evidence: the finding ids, the evidence URLs, and every text it may copy. */
function evidenceOf(sheet: GuardSheet): Evidence {
  const findings = isList(sheet?.findings) ? sheet.findings : [];
  const ids = new Set<string>(findings.map((finding) => finding.id));
  const urls = new Set<string>();
  const texts = [...ids];
  for (const finding of findings) {
    for (const item of finding.evidence ?? []) {
      if (typeof item?.url === 'string') urls.add(item.url);
      for (const text of [item?.label, item?.url, item?.excerpt]) if (typeof text === 'string') texts.push(text);
    }
  }
  return { ids, urls, holds: (span: string) => texts.some((text) => text.includes(span)) };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function escape(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
