// The roadmaps' half of the contract (PRD 1162's spec, "Roadmaps in Omni"), as a plain function of a
// Request, so it is tested with a stubbed Supabase client and the route under app/api/roadmaps/ stays
// one line:
//
//   POST /api/roadmaps {repo, roadmap, title, milestone, product?, target?, source?, questions?, document,
//                       prds: [{id, prd, title, repos?, blockers?, wave, state, waitsOn?, waitsOnUrl?,
//                               startedAt?, endedAt?}],
//                       humanWork?: [{key, prd?, repo, source, text, act?, url?, ruleKind}]}
//     → 201 a new roadmap, 200 one pushed again: {roadmapId, created, product, unknownProduct, note}
//
// The kit's `omni roadmap push` sends it: roadmap.md's front matter, the questions with any answer, the
// document itself, and each PRD's row with its state. Nothing else is taken: an unknown field is
// refused, so no path, prompt or transcript can ever be stored. The database files the roadmap in its
// repository's workspace, matches the product by name among the workspace's own and replaces the PRD
// rows on every push (roadmap_push(), supabase/migrations/20261110090000_roadmaps.sql). A product named
// but unknown is filed under none: `unknownProduct` names it and `note` says it in one line.
//
// `humanWork` (PRD 1217) is every piece of human work the roadmap's PRDs wait on now, each with the kind
// the kit's rules gave it. roadmap_push() keeps one row per key (supabase/migrations/
// 20261113090000_roadmap_human_work.sql): a new key with its kind, a stored key keeping its own, a key
// missing from the push done. A body without the field, from a kit before it, changes no stored entry.
// Once such a push is recorded, `classify` offers the new keys to Jev's `hitl-category` (PRD 1217 s3,
// ./classify-jev.ts), after the answer: the push never waits on it, nor fails because of it.
//
// Refusals follow ADR-0029, each `{error}` in plain words: 400 a malformed body, 401 no valid bearer
// token, 403 a repository no workspace of the caller owns (with the App's install link after its hint),
// 413 a body over its cap, 503 no database here or the sign-in service down, 500 the database failed.
import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { IssueNumberSchema, PrdNumberSchema } from 'vertuo-omni-plan/kit/lib/ids.ts';
import { withInstallLink, type TokenCheck } from '../ask/auth';
import { Line, receivePush, refuse, WebLink, When } from '../data/kit-push';
import { HumanWorkKey, HumanWorkKind, HumanWorkSource, RoadmapPrdState, RoadmapQuestion, RowIdSchema, roadmapStore, RoadmapStoreError, type RoadmapPush, type RoadmapPushAnswer } from './store';

/** The largest push: a roadmap.md of two hundred rows and its PRDs, with room to spare. */
export const MAX_PUSH_BYTES = 256 * 1024;

/** A Supabase client acting as one access token: the Auth server's check and the function. */
export type RoadmapClient = TokenCheck & Pick<SupabaseClient, 'rpc'>;

export type RoadmapDeps = {
  /** A client acting as the given access token, or null when no database is configured. */
  connect: ((token: string) => RoadmapClient) | null;
  /** The App's install link, put after the database's install hint; null or missing: the hint alone. */
  installLink?: string | null;
  /**
   * Offers a pushed roadmap's new keys to Jev's `hitl-category` (./classify-jev.ts), once the push has
   * answered; missing: no Jev here, and every key keeps its rule kind. Called only after a push that
   * carried `humanWork` was recorded; whatever it does, the push has already succeeded.
   */
  classify?: (roadmapId: string) => void;
};

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
  waitsOnUrl: WebLink.nullable().default(null),
  startedAt: When.nullable().default(null),
  endedAt: When.nullable().default(null),
}).refine((prd) => prd.endedAt === null || prd.startedAt === null || Date.parse(prd.endedAt) >= Date.parse(prd.startedAt), {
  message: 'it ends before it starts', path: ['endedAt'],
});

/** A repository human work is in: the roadmap's own (owner/name) or a target's short name. */
const WorkRepo = z.string().max(200).regex(/^[A-Za-z0-9_.-]+(\/[A-Za-z0-9_.-]+)?$/, 'a repository\'s name');

const HumanWork = z.strictObject({
  key: HumanWorkKey,
  prd: PrdNumberSchema.nullable().default(null),
  repo: WorkRepo,
  source: HumanWorkSource,
  text: Line(1000),
  act: Line(4000).nullable().default(null),
  url: WebLink.nullable().default(null),
  ruleKind: HumanWorkKind,
}).refine((work) => work.key.startsWith(`${work.source}:`), { message: 'its key is not its source\'s', path: ['key'] });

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
  humanWork: z.array(HumanWork).max(500).optional(),
}).refine((push) => new Set(push.prds.map((p) => p.id)).size === push.prds.length, {
  message: 'a row id is used twice', path: ['prds'],
}).refine((push) => push.humanWork === undefined || new Set(push.humanWork.map((h) => h.key)).size === push.humanWork.length, {
  message: 'a key is used twice', path: ['humanWork'],
});

/** The status each refusal of the database answers with; any other failure is a 500. */
const REFUSAL_STATUS: Readonly<Record<string, number>> = { '42501': 403, '22023': 400, '23514': 400 };

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
  const status = error.code === undefined ? undefined : REFUSAL_STATUS[error.code];
  if (status === undefined) {
    console.error(`roadmaps: ${error.message}`);
    return refuse(500, 'The roadmap could not be recorded. Try again.');
  }
  return refuse(status, status === 403 ? withInstallLink(error.reason, deps.installLink) : error.reason);
}

/** Hands the roadmap to the classifier, when there is one; a classifier that cannot start fails nothing. */
function classifyAfter(deps: RoadmapDeps, roadmapId: string): void {
  try {
    deps.classify?.(roadmapId);
  } catch (error) {
    console.error(`roadmaps: the human work of roadmap ${roadmapId} keeps its rule kinds (${error instanceof Error ? error.message : String(error)})`);
  }
}

/** The answer, with the one line the kit prints when the product matched none. */
function answered(answer: RoadmapPushAnswer) {
  const note = answer.unknownProduct === null ? null : `No product named "${answer.unknownProduct}" in this workspace: the roadmap is filed under none.`;
  return { ...answer, note };
}

export async function roadmapPush(request: Request, deps: RoadmapDeps): Promise<Response> {
  const received = await receivePush(request, deps.connect, {
    unavailable: 'Roadmaps are not available here: this deployment has no database.',
    maxBytes: MAX_PUSH_BYTES,
  });
  if (received instanceof Response) return received;
  const push = pushOf(received.sent);
  if ('problem' in push) return refuse(400, push.problem);

  try {
    const answer = await roadmapStore(received.client()).push(push);
    if (push.humanWork !== undefined) classifyAfter(deps, answer.roadmapId);
    return Response.json(answered(answer), { status: answer.created ? 201 : 200, headers: { 'cache-control': 'no-store' } });
  } catch (error) {
    if (!(error instanceof RoadmapStoreError)) throw error;
    return refusal(error, deps);
  }
}
