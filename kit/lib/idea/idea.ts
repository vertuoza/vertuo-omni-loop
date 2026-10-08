// A repository's ideas board, as the terminal sees it (PRD 1246, s2): `omni idea add` checks an idea
// before it sends it, and `omni idea list` reads the board the app answers and lays it out lane by
// lane. Pure: the calls themselves are the ask client's (`../ask/client.ts`, `addIdea`, `listIdeas`).
//
// The limits are the database's own (supabase/migrations/20261114090000_ideas.sql): a title of 1 to
// 120 characters, a pitch of 1 to 600, a lane of now, next or later, later when none is given.
import { z } from 'zod';
import { PrdNumberSchema } from '../ids.ts';
import { isOneOf } from '../narrow.ts';

/** The board's lanes, in its order. A member sets an idea's lane; votes sort ideas inside one. */
const LANES = ['now', 'next', 'later'] as const;
export type Lane = (typeof LANES)[number];

/** The lane an idea goes to when none is given. */
const DEFAULT_LANE: Lane = 'later';
export const TITLE_MAX = 120;
export const PITCH_MAX = 600;

const LANE_NAMES: Readonly<Record<Lane, string>> = { now: 'Now', next: 'Next', later: 'Later' };

/** An idea ready to send: trimmed, its lane settled. */
export type NewIdea = { title: string; pitch: string; lane: Lane };

/** The idea `omni idea add` was given, or the one problem with it, in the words a usage error prints. */
export function checkIdea({ title, pitch, lane }: { title: string; pitch: string; lane: string | undefined }):
  { ok: true; idea: NewIdea } | { ok: false; problem: string } {
  const t = title.trim();
  const p = pitch.trim();
  if (lane !== undefined && !isOneOf(LANES, lane)) return { ok: false, problem: `--lane is now, next or later, not "${lane}".` };
  if (!t) return { ok: false, problem: 'an idea needs a title.' };
  if (!p) return { ok: false, problem: 'an idea needs a pitch (--pitch).' };
  if (t.length > TITLE_MAX) return { ok: false, problem: `a title holds ${TITLE_MAX} characters at most (this one has ${t.length}).` };
  if (p.length > PITCH_MAX) return { ok: false, problem: `a pitch holds ${PITCH_MAX} characters at most (this one has ${p.length}).` };
  return { ok: true, idea: { title: t, pitch: p, lane: lane ?? DEFAULT_LANE } };
}

/** One idea of the list reply: what the terminal shows of it. */
const ListedIdea = z.looseObject({
  title: z.string(),
  pitch: z.string(),
  lane: z.enum(LANES),
  prd: PrdNumberSchema.nullable(),
  votes: z.number().int().nonnegative(),
});
export type ListedIdea = z.infer<typeof ListedIdea>;

/** `GET /api/ideas?repo=<owner/name>`'s reply: the board's repository, its link, and its ideas, each
 * lane already sorted by the app (most votes first, then the oldest). */
const ListReply = z.looseObject({
  repo: z.string(),
  url: z.string(),
  ideas: z.array(ListedIdea),
});

/** The board as `omni idea list` shows it: its three lanes, Now, Next then Later. */
export type IdeasBoard = { repo: string; url: string; lanes: { lane: Lane; ideas: ListedIdea[] }[] };

/** The board a list reply carries, or null when the reply is not one. */
export function boardOf(reply: unknown): IdeasBoard | null {
  const parsed = ListReply.safeParse(reply);
  if (!parsed.success) return null;
  const { repo, url, ideas } = parsed.data;
  return { repo, url, lanes: LANES.map((lane) => ({ lane, ideas: ideas.filter((idea) => idea.lane === lane) })) };
}

/** The board in lines: its repository and link, then each lane and its ideas with their votes. */
export function listLines({ repo, url, lanes }: IdeasBoard): string[] {
  const lines = [`${repo} — ${url}`];
  for (const { lane, ideas } of lanes) {
    lines.push(LANE_NAMES[lane]);
    if (ideas.length === 0) lines.push('  (none)');
    for (const { title, votes, prd } of ideas) lines.push(`  ▲ ${votes}  ${title}${prd === null ? '' : ` · PRD #${prd}`}`);
  }
  return lines;
}
