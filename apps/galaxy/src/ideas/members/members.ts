// A member's controls on an ideas board (PRD 1246, s4), as pure data: the "Brainstorm this" line every
// card shows, and what the add and edit forms read, checked against the board's rules before a write
// (the database checks them again: supabase/migrations/20261114090000_ideas.sql).
import { z } from 'zod';
import { PrdNumberSchema, type PrdNumber } from 'vertuo-omni-plan/kit/lib/ids.ts';
import { LANES, type Idea, type Lane } from '../model';
import { MEMBERS } from './words';

/** The line a card offers to copy into Claude: /omni:brainstorm '<title>: <pitch>'. */
export const brainstormLine = (idea: Pick<Idea, 'title' | 'pitch'>) => `/omni:brainstorm '${idea.title}: ${idea.pitch}'`;

/** What a member sets on an idea from its form. */
export type IdeaFields = { title: string; pitch: string; lane: Lane; prd: PrdNumber | null };

/** What a member sends of an idea: its fields, or only that it is archived. */
export type IdeaChange = IdeaFields | { archived: true };

/** The form as the browser hands it: every field a string. */
export type IdeaForm = { title: string; pitch: string; lane: string; prd: string };

export type ReadForm = { ok: true; idea: IdeaFields } | { ok: false; problem: string };

const Title = z.string().trim().min(1).max(120);
const Pitch = z.string().trim().min(1).max(600);
const LaneField = z.enum(LANES);
/** Nothing, or a PRD number, its # allowed. */
const PrdField = z.string().trim().transform((text, ctx) => {
  if (!text) return null;
  const digits = /^#?(\d+)$/.exec(text)?.[1];
  const prd = PrdNumberSchema.safeParse(digits === undefined ? Number.NaN : Number(digits));
  if (prd.success) return prd.data;
  ctx.addIssue({ code: 'custom', message: 'prd' });
  return z.NEVER;
});

/** The form's fields, checked one by one, the first refusal in plain words. */
export function readForm(form: IdeaForm): ReadForm {
  const title = Title.safeParse(form.title);
  if (!title.success) return { ok: false, problem: MEMBERS.badTitle };
  const pitch = Pitch.safeParse(form.pitch);
  if (!pitch.success) return { ok: false, problem: MEMBERS.badPitch };
  const lane = LaneField.safeParse(form.lane);
  if (!lane.success) return { ok: false, problem: MEMBERS.badLane };
  const prd = PrdField.safeParse(form.prd);
  if (!prd.success) return { ok: false, problem: MEMBERS.badPrd };
  return { ok: true, idea: { title: title.data, pitch: pitch.data, lane: lane.data, prd: prd.data } };
}
