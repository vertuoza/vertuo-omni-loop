// A PRD's `voice.json` (PRD 822): what the product's personas said of it, a round per stage. It sits
// beside the spec in the PRD's folder; `omni check inbox` refuses one that does not read, and
// `omni dossier push` sends it as the dossier's `voice` artifact. `example.json` beside this file is
// the shape every reader tests against.
//
//   { "rounds": [ {
//       "stage": "design" | "spec" | "rework-<k>" | "shipped",   each once, k from 1
//       "date": "YYYY-MM-DD",
//       "personas": [ { "name", "stance": excited|neutral|skeptical, "score": 1–5,
//                       "reaction": at most two sentences, "citations": [persona:<name> | <kind>#<n>, …] } ],
//       "objection": null | { "persona": one of the round's, "text": at most two sentences, "citations",
//                             "settled": accepted|saved-as-claim|just-this-run|none },
//       "fit": null | "fits persona:Marc ✓ · size#2 ✓" } ] }
//
// Reads text, calls nothing. Every refusal names the round (its stage, else its place) and the field.
import { textOf } from '../narrow.ts';

export const VOICE_FILE = 'voice.json';

const STAGE = /^(?:design|spec|shipped|rework-[1-9]\d*)$/;
const STAGES_SAID = 'design, spec, rework-<k>, shipped';
const STANCES = ['excited', 'neutral', 'skeptical'] as const;
const SETTLED = ['accepted', 'saved-as-claim', 'just-this-run', 'none'] as const;
const KNOWN_STANCES: readonly unknown[] = STANCES;
const KNOWN_SETTLED: readonly unknown[] = SETTLED;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
/** A persona (`persona:Marc`) or a claim id of one of the business's kinds (`size#2`). */
const CITATION = /^(?:persona:\S.*|(?:region|offering|size|trade|rival)#[1-9]\d*)$/;
const MAX_SENTENCES = 2;

const TOP_FIELDS = ['rounds'];
const ROUND_FIELDS = ['stage', 'date', 'personas', 'objection', 'fit'];

/** One persona's say in a round. */
export type VoicePersona = {
  name: string;
  stance: (typeof STANCES)[number];
  score: number;
  reaction: string;
  citations: string[];
};
/** The objection a round raised, and how it was settled. */
export type VoiceObjection = { persona: string; text: string; citations: string[]; settled: (typeof SETTLED)[number] };
/** One round of a voice.json. */
export type VoiceRound = {
  stage: string;
  date: string;
  personas: VoicePersona[];
  objection?: VoiceObjection | null;
  fit?: string | null;
};
/** A voice.json, read. */
export type Voice = { rounds: VoiceRound[] };

export type VoiceParse = { ok: true; voice: Voice; errors: [] } | { ok: false; voice: null; errors: string[] };

type Fields = Record<string, unknown>;

const isRecord = (value: unknown): value is Fields => typeof value === 'object' && value !== null && !Array.isArray(value);
const isText = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;

/** How many sentences `text` holds: each ends at `.`, `!` or `?` before a space or the end. */
export function countSentences(text: string): number {
  return text
    .split(/[.!?]+(?=\s|$)/)
    .filter((part) => part.trim().length > 0).length;
}

/** What is wrong with a list of citations at `field`. */
function citationProblems(citations: unknown, field: string): string[] {
  if (!Array.isArray(citations) || citations.length === 0) {
    return [`${field} must cite at least one persona:<name> or claim id.`];
  }
  return citations.flatMap((citation, i) =>
    typeof citation === 'string' && CITATION.test(citation)
      ? []
      : [`${field}[${i}] ${JSON.stringify(citation)} is neither persona:<name> nor a claim id like size#2.`],
  );
}

/** What is wrong with a line a persona says, at most two sentences, at `field`. */
function lineProblems(text: unknown, field: string): string[] {
  if (!isText(text)) return [`${field} must be a sentence.`];
  const count = countSentences(text);
  return count > MAX_SENTENCES ? [`${field} holds ${count} sentences; two at most.`] : [];
}

function personaProblems(persona: unknown, i: number): string[] {
  const at = `personas[${i}]`;
  if (!isRecord(persona)) return [`${at} must be an object.`];
  const problems: string[] = [];
  if (!isText(persona.name)) problems.push(`${at}.name must be a name.`);
  if (!KNOWN_STANCES.includes(persona.stance)) problems.push(`${at}.stance must be one of ${STANCES.join(', ')}.`);
  const { score } = persona;
  if (typeof score !== 'number' || !Number.isInteger(score) || score < 1 || score > 5) {
    problems.push(`${at}.score must be a whole number from 1 to 5.`);
  }
  problems.push(...lineProblems(persona.reaction, `${at}.reaction`));
  problems.push(...citationProblems(persona.citations, `${at}.citations`));
  return problems;
}

function objectionProblems(objection: unknown, names: readonly unknown[]): string[] {
  if (objection === null) return [];
  if (!isRecord(objection)) return ['objection must be an object, or null when no persona objected.'];
  const problems: string[] = [];
  if (!isText(objection.persona)) problems.push('objection.persona must be a name.');
  else if (names.length > 0 && !names.includes(objection.persona)) {
    problems.push(`objection.persona ${JSON.stringify(objection.persona)} is not one of the round's personas.`);
  }
  problems.push(...lineProblems(objection.text, 'objection.text'));
  problems.push(...citationProblems(objection.citations, 'objection.citations'));
  if (!KNOWN_SETTLED.includes(objection.settled)) problems.push(`objection.settled must be one of ${SETTLED.join(', ')}.`);
  return problems;
}

/** The fields of `value` that `known` does not name, one problem each. */
const unknownFields = (value: Fields, known: readonly string[], where: string): string[] =>
  Object.keys(value)
    .filter((key) => !known.includes(key))
    .map((key) => `\`${key}\` is not a field of ${where}.`);

const personasProblems = (personas: unknown): string[] =>
  Array.isArray(personas) && personas.length > 0
    ? personas.flatMap(personaProblems)
    : ['personas must list at least one persona.'];

const fitProblems = (fit: unknown): string[] => (fit === undefined || fit === null || isText(fit) ? [] : ['fit must be one line, or null.']);

/** Every problem of one round, each without its round's name. */
function roundProblems(round: unknown): string[] {
  if (!isRecord(round)) return ['must be an object.'];
  const names: unknown[] = Array.isArray(round.personas) ? round.personas.map((p: unknown) => (isRecord(p) ? p.name : undefined)) : [];
  return [
    ...unknownFields(round, ROUND_FIELDS, 'a round'),
    ...(DATE.test(textOf(round.date)) ? [] : ['date must be YYYY-MM-DD.']),
    ...personasProblems(round.personas),
    ...objectionProblems(round.objection ?? null, names),
    ...fitProblems(round.fit),
  ];
}

/** Reads a voice.json's text. */
export function parseVoice(text: string): VoiceParse {
  let voice: unknown;
  try {
    voice = JSON.parse(text);
  } catch {
    return { ok: false, voice: null, errors: ['not valid JSON.'] };
  }
  if (!isRecord(voice) || !Array.isArray(voice.rounds)) {
    return { ok: false, voice: null, errors: ['must be an object with a `rounds` list.'] };
  }
  const errors = unknownFields(voice, TOP_FIELDS, 'voice.json');
  if (voice.rounds.length === 0) errors.push('`rounds` holds no round.');

  const seen = new Set<string>();
  voice.rounds.forEach((round: unknown, i: number) => {
    const stage = isRecord(round) ? round.stage : undefined;
    const known = typeof stage === 'string' && STAGE.test(stage);
    const name = known ? `round ${stage}` : `round ${i + 1}`;
    if (!known) errors.push(`${name}: stage ${JSON.stringify(stage ?? null)} is not one of ${STAGES_SAID}.`);
    else if (seen.has(stage)) errors.push(`${name}: the stage comes twice.`);
    if (known) seen.add(stage);
    errors.push(...roundProblems(round).map((problem) => `${name}: ${problem}`));
  });

  if (errors.length) return { ok: false, voice: null, errors };
  return { ok: true, voice: voice as Voice, errors: [] }; // ts-allow: every field of every round was checked above
}
