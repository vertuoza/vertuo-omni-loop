// The roadmaps' half of the contract (PRD 1162's spec, "Roadmaps in Omni"), as a plain function of a
// Request, so it is tested with a stubbed Supabase client and the route under app/api/roadmaps/ stays
// one line:
//
//   POST /api/roadmaps {repo, roadmap, title, milestone, product?, target?, source?, questions?, document,
//                       prds: [{id, prd, title, repos?, blockers?, wave, state, waitsOn?, waitsOnUrl?,
//                               startedAt?, endedAt?}]}
//     → 201 a new roadmap, 200 one pushed again: {roadmapId, created, product, unknownProduct, note}
//
// The kit's `omni roadmap push` sends it: roadmap.md's front matter, the questions with any answer, the
// document itself, and each PRD's row with its state. Nothing else is taken: an unknown field is
// refused, so no path, prompt or transcript can ever be stored. The database files the roadmap in its
// repository's workspace, matches the product by name among the workspace's own and replaces the PRD
// rows on every push (roadmap_push(), supabase/migrations/20261109090000_roadmaps.sql). A product named
// but unknown is filed under none: `unknownProduct` names it and `note` says it in one line.
//
// Refusals follow ADR-0029, each `{error}` in plain words: 400 a malformed body, 401 no valid bearer
// token, 403 a repository no workspace of the caller owns (with the App's install link after its hint),
// 413 a body over its cap, 503 no database here or the sign-in service down, 500 the database failed.
import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { IssueNumberSchema, PrdNumberSchema } from 'vertuo-omni-plan/kit/lib/ids.ts';
import { authenticate, withInstallLink, type TokenCheck } from '../ask/auth';
import { RoadmapPrdState, RoadmapQuestion, RowIdSchema, roadmapStore, RoadmapStoreError, type RoadmapPush, type RoadmapPushAnswer } from './store';

/** The largest push: a roadmap.md of two hundred rows and its PRDs, with room to spare. */
export const MAX_PUSH_BYTES = 256 * 1024;

/** A Supabase client acting as one access token: the Auth server's check and the function. */
export type RoadmapClient = TokenCheck & Pick<SupabaseClient, 'rpc'>;

export type RoadmapDeps = {
  /** A client acting as the given access token, or null when no database is configured. */
  connect: ((token: string) => RoadmapClient) | null;
  /** The App's install link, put after the database's install hint; null or missing: the hint alone. */
  installLink?: string | null;
};

const Line = (max: number) => z.string().trim().min(1).max(max);
const Link = z.string().max(500).regex(/^https?:\/\/\S+$/, 'a web address');
const When = z.iso.datetime({ offset: true });
const RepoName = z.string().regex(/^[A-Za-z0-9_.-]+$/, 'a target\'s short name');

const Prd = z.strictObject({
  id: RowIdSchema,
  prd: PrdNumberSchema,
  title: Line(200),
  repos: z.array(RepoName).max(20).default([]),
  blockers: z.array(RowIdSchema).max(50).default([]),
  wave: z.number().int().min(1).max(1000),
  state: RoadmapPrdState,
  waitsOn: Line(300).nullable().default(null),
  waitsOnUrl: Link.nullable().default(null),
  startedAt: When.nullable().default(null),
  endedAt: When.nullable().default(null),
}).refine((prd) => prd.endedAt === null || prd.startedAt === null || Date.parse(prd.endedAt) >= Date.parse(prd.startedAt), {
  message: 'it ends before it starts', path: ['endedAt'],
});

const Push = z.strictObject({
  repo: z.string().max(200).regex(/^[\w.-]+\/[\w.-]+$/, 'owner/name'),
  roadmap: IssueNumberSchema,
  title: Line(200),
  milestone: Line(500),
  product: Line(80).nullable().default(null),
  target: z.iso.date().nullable().default(null),
  source: Line(500).nullable().default(null),
  questions: z.array(RoadmapQuestion).max(100).default([]),
  document: z.string().min(1).max(200_000),
  prds: z.array(Prd).max(200),
}).refine((push) => new Set(push.prds.map((p) => p.id)).size === push.prds.length, {
  message: 'a row id is used twice', path: ['prds'],
});

const refuse = (status: number, error: string) => Response.json({ error }, { status, headers: { 'cache-control': 'no-store' } });

/** The first problem zod found, in one line naming the field. */
function problemOf(error: z.ZodError): string {
  const issue = error.issues[0];
  if (issue?.code === 'unrecognized_keys') return `A roadmap push does not carry ${issue.keys.join(', ')}.`;
  return `A roadmap push's \`${issue?.path.join('.') ?? ''}\` is malformed: ${issue?.message ?? 'see the contract'}.`;
}

/** The push a body carries, or the problem with it. */
function pushOf(sent: unknown): RoadmapPush | { problem: string } {
  if (typeof sent !== 'object' || sent === null || Array.isArray(sent)) return { problem: 'The body must be a JSON object.' };
  const parsed = Push.safeParse(sent);
  return parsed.success ? parsed.data : { problem: problemOf(parsed.error) };
}

/** The database's refusal as the contract's answer; a failure is a 500, never a guess. */
function refusal(error: RoadmapStoreError, deps: RoadmapDeps): Response {
  if (error.code === '42501') return refuse(403, withInstallLink(error.reason, deps.installLink));
  if (error.code === '22023' || error.code === '23514') return refuse(400, error.reason);
  console.error(`roadmaps: ${error.message}`);
  return refuse(500, 'The roadmap could not be recorded. Try again.');
}

/** What a push sent, read as JSON, or the refusal its size or its syntax earns. */
async function sentOf(request: Request): Promise<{ sent: unknown } | Response> {
  const tooLarge = () => refuse(413, `A push carries ${MAX_PUSH_BYTES / 1024} KiB at most.`);
  if (Number(request.headers.get('content-length') ?? 0) > MAX_PUSH_BYTES) return tooLarge();
  const text = await request.text();
  if (new TextEncoder().encode(text).length > MAX_PUSH_BYTES) return tooLarge();
  try {
    const sent: unknown = JSON.parse(text);
    return { sent };
  } catch {
    return refuse(400, 'The body must be a JSON object.');
  }
}

/** The answer, with the one line the kit prints when the product matched none. */
function answered(answer: RoadmapPushAnswer) {
  const note = answer.unknownProduct === null ? null : `No product named "${answer.unknownProduct}" in this workspace: the roadmap is filed under none.`;
  return { ...answer, note };
}

export async function roadmapPush(request: Request, deps: RoadmapDeps): Promise<Response> {
  if (!deps.connect) return refuse(503, 'Roadmaps are not available here: this deployment has no database.');
  const auth = await authenticate(request.headers.get('authorization'), deps.connect);
  if (!auth.ok) return refuse(auth.status, auth.error);

  const read = await sentOf(request);
  if (read instanceof Response) return read;
  const push = pushOf(read.sent);
  if ('problem' in push) return refuse(400, push.problem);

  try {
    const answer = await roadmapStore(deps.connect(auth.caller.token)).push(push);
    return Response.json(answered(answer), { status: answer.created ? 201 : 200, headers: { 'cache-control': 'no-store' } });
  } catch (error) {
    if (!(error instanceof RoadmapStoreError)) throw error;
    return refusal(error, deps);
  }
}
