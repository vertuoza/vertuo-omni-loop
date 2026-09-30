import { z } from 'zod';
import type { PersonaAvatar } from '@omni/design';

// The User voice tab (PRD 822, s3), as pure functions: a version of the PRD's `voice` artifact read
// through galaxy's own schema (the kit's `kit/lib/voice/` refuses a bad file before it is pushed; this
// reads what it accepts), then the grid the tab draws: one row per persona — its portrait from the
// workspace's personas (PRD 799) when one of them bears its name, else its initial; its name, its
// stance chip and its latest reaction — and one column per round, left to right as the file holds them.
// Each cell is the persona's score out of 5 and its move from the last score it gave before (▲ up,
// ▼ down, = the same; none on its first), with that round's reaction behind it. Each round keeps its
// objection, outlined with how it was settled, or none when nobody objected, and its fit line.

const STAGE = /^(?:design|spec|shipped|rework-[1-9]\d*)$/;
const STANCES = ['excited', 'neutral', 'skeptical'] as const;
const SETTLED = ['accepted', 'saved-as-claim', 'just-this-run', 'none'] as const;

const citations = z.array(z.string().min(1)).min(1);
const personaSchema = z.object({
  name: z.string().trim().min(1),
  stance: z.enum(STANCES),
  score: z.number().int().min(1).max(5),
  reaction: z.string().trim().min(1),
  citations,
});
const objectionSchema = z.object({ persona: z.string().trim().min(1), text: z.string().trim().min(1), citations, settled: z.enum(SETTLED) });
const roundSchema = z.object({
  stage: z.string().regex(STAGE),
  date: z.string().regex(/^\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])$/),
  personas: z.array(personaSchema).min(1),
  objection: objectionSchema.nullish().transform((o) => o ?? null),
  fit: z.string().trim().min(1).nullish().transform((f) => f ?? null),
});
const voiceSchema = z.object({ rounds: z.array(roundSchema).min(1) });

export type Voice = z.infer<typeof voiceSchema>;
export type VoiceStance = (typeof STANCES)[number];

/** A voice.json version's text as the tab reads it; null when it is not one. */
export function readVoice(text: string): Voice | null {
  try {
    const parsed = voiceSchema.safeParse(JSON.parse(text));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

/** A persona of the workspace, as far as its portrait needs. */
export type VoiceCast = { name: string; trade: string; avatar: PersonaAvatar };

export type VoiceMove = '▲' | '▼' | '=';

/** One persona in one round: its score (`4/5`, null when it sat the round out), its move from the last
 * score it gave (`from`, null on its first), `words` saying both (`3/5 → 5/5 ▲`), and its reaction. */
export type VoiceCell = {
  stage: string; score: string | null; from: string | null; move: VoiceMove | null; words: string | null;
  reaction: string | null; citations: string[];
  /** This persona raised the round's objection. */
  objected: boolean;
};

export type VoiceRow = {
  name: string; stance: VoiceStance; latest: string;
  /** The portrait's trade and avatar, from the workspace's persona of this name; null when none is. */
  portrait: { trade: string; avatar: PersonaAvatar } | null;
  initial: string;
  cells: VoiceCell[];
};

export type VoiceObjection = { persona: string; text: string; citations: string[]; settled: string };

export type VoiceRound = { stage: string; label: string; date: string; objection: VoiceObjection | null; fit: string | null };

export type VoiceView = { rounds: VoiceRound[]; rows: VoiceRow[] };

/** How an objection was settled, in words. */
export const SETTLED_WORDS: Readonly<Record<(typeof SETTLED)[number], string>> = {
  accepted: 'Accepted: the PRD changed',
  'saved-as-claim': 'Saved as a claim',
  'just-this-run': 'Overruled for this run',
  none: 'Not settled yet',
};

/** A round's stage, for a person: Design, Spec, Rework 2, Shipped. */
export function stageLabel(stage: string): string {
  const rework = /^rework-(\d+)$/.exec(stage);
  if (rework) return `Rework ${rework[1]}`;
  return stage.charAt(0).toUpperCase() + stage.slice(1);
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** `30 Sep`, from the round's `YYYY-MM-DD`, as the page's other dates read. */
const dayOf = (date: string) => `${Number(date.slice(8, 10))} ${MONTHS[Number(date.slice(5, 7)) - 1]}`;

const outOf5 = (score: number) => `${score}/5`;
const moveOf = (from: number, to: number): VoiceMove => (to > from ? '▲' : to < from ? '▼' : '=');

function cellsOf(name: string, voice: Voice): VoiceCell[] {
  let last: number | null = null;
  return voice.rounds.map((round): VoiceCell => {
    const said = round.personas.find((p) => p.name === name);
    const objected = round.objection?.persona === name;
    if (!said) return { stage: round.stage, score: null, from: null, move: null, words: null, reaction: null, citations: [], objected };
    const from = last;
    last = said.score;
    const move = from === null ? null : moveOf(from, said.score);
    const score = outOf5(said.score);
    return {
      stage: round.stage, score, from: from === null ? null : outOf5(from), move,
      words: from === null ? score : `${outOf5(from)} → ${score} ${move}`,
      reaction: said.reaction, citations: said.citations, objected,
    };
  });
}

/** The tab's grid, from a read voice.json and the workspace's personas (for the portraits). */
export function voiceView(voice: Voice, cast: readonly VoiceCast[]): VoiceView {
  const names = [...new Set(voice.rounds.flatMap((r) => r.personas.map((p) => p.name)))];
  const rows = names.map((name): VoiceRow => {
    const latest = [...voice.rounds].reverse().flatMap((r) => r.personas).find((p) => p.name === name)!;
    const known = cast.find((c) => c.name === name);
    return {
      name, stance: latest.stance, latest: latest.reaction,
      portrait: known ? { trade: known.trade, avatar: known.avatar } : null,
      initial: name.charAt(0).toUpperCase(),
      cells: cellsOf(name, voice),
    };
  });
  const rounds = voice.rounds.map((round): VoiceRound => ({
    stage: round.stage,
    label: stageLabel(round.stage),
    date: dayOf(round.date),
    objection: round.objection && {
      persona: round.objection.persona, text: round.objection.text, citations: round.objection.citations,
      settled: SETTLED_WORDS[round.objection.settled],
    },
    fit: round.fit,
  }));
  return { rounds, rows };
}

/** What Rework with this feedback copies. */
export const reworkCommand = (prd: number) => `/omni:brainstorm --rework ${prd}`;

/** What the tab says with no voice artifact. */
export const VOICE_EMPTY = 'No voice yet: it appears once a brainstorm runs with personas';
