// `omni approval tech request <n> [--to <login>]` (PRD 2608, s3): asks one member of the workspace for a
// PRD's Tech Approval on the Omni page (`POST /api/dossiers/approval/tech`), or, with nobody named, lists
// the members who can be (`GET /api/dossiers/approval/tech`), for `/omni:brainstorm` to offer. Who may
// request it, and of whom, is the database's to say: its refusal comes through in its own words.
import { z } from 'zod';
import { AskCallError } from '../ask/client.ts';
import type { PrdNumber } from '../ids.ts';
import { UNREACHABLE_LINE, waitingForTech } from './approval.ts';

const text = z.string().min(1);

/** The tech route's answer to a request: the person named, and the PRD's page. */
export const TechRequestedSchema = z.object({ login: text, state: z.literal('asked'), url: text });

/** The tech route's answer with nobody named: the workspace's members who have a login. */
export const TechMembersSchema = z.object({ members: z.array(z.object({ login: text, name: text.nullable() })) });

/** The calls this module makes, as the ask client makes them. */
type TechClient = {
  readTechMembers(args: { repo: string; prd: PrdNumber }): Promise<unknown>;
  requestTechApproval(args: { repo: string; prd: PrdNumber; login: string }): Promise<unknown>;
};

/** What a call came to: the lines to print, or why it did not go through. */
type TechResult = { ok: true; lines: string[] } | { ok: false; why: string };

/** Why a call did not go through: the page's own words when it gave some. */
function whyOf(error: unknown): TechResult {
  if (!(error instanceof AskCallError)) throw error;
  if (error.status === null) return { ok: false, why: UNREACHABLE_LINE };
  return { ok: false, why: error.reason ?? `refused (${error.status})` };
}

const MALFORMED: TechResult = { ok: false, why: 'refused (malformed reply)' };

/** Reads the workspace's members, one login per line. */
export async function listTechMembers(client: TechClient, repo: string, prd: PrdNumber): Promise<TechResult> {
  let body: unknown;
  try {
    body = await client.readTechMembers({ repo, prd });
  } catch (error) {
    return whyOf(error);
  }
  const reply = TechMembersSchema.safeParse(body);
  return reply.success ? { ok: true, lines: reply.data.members.map((member) => member.login) } : MALFORMED;
}

/** Requests the Tech Approval of `login`, and says who the PRD now waits on. */
export async function sendTechRequest(client: TechClient, repo: string, prd: PrdNumber, login: string): Promise<TechResult> {
  let body: unknown;
  try {
    body = await client.requestTechApproval({ repo, prd, login });
  } catch (error) {
    return whyOf(error);
  }
  const reply = TechRequestedSchema.safeParse(body);
  if (!reply.success) return MALFORMED;
  return { ok: true, lines: [`PRD ${Number(prd)} · ${waitingForTech(reply.data.login)}: ${reply.data.url}`] };
}
