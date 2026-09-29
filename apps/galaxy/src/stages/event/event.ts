// A stage event (PRD 587): omni-app saw a pull request move a PRD (a phase-0 or slice PR merged, the
// feature PR marked ready or merged, a retro PR opened) and POSTs `{ repository, topic, prd | null,
// stage, at }` here, signed with an HMAC-SHA256 over the exact body under STAGE_EVENT_SECRET, which both
// apps share. Events only make the 15-minute sync faster; the sync is the truth.
//
//   - a missing secret, or a bad or missing signature → 401, nothing written;
//   - a signed body that is not a stage event → 400;
//   - no workspace owns the repository, or the PRD is found neither by number nor by its topic → 202,
//     nothing written: the next sync records it anyway;
//   - placed → the stage is recorded for the PRD in each workspace that owns the repository, with the
//     event's date, and a stage already stored keeps its first date (the store's rule) → 200.
//
// PRD 657 (s5): each PRD placed then has its open outbox questions recounted into prd_outbox, so /prd
// sees a feature PR's change before the next sync. A recount that fails is logged; the reply stands.
import { createHmac, timingSafeEqual } from 'node:crypto';
import type { StoredStage } from '../stage';
import type { StageStore } from '../store';

/** The header omni-app signs with: `sha256=<hex>`. */
export const STAGE_SIGNATURE_HEADER = 'x-omni-signature-256';

/** The stages a pull request event can show: every stored stage but PRD, which only the sync sees. */
const EVENT_STAGES: readonly StoredStage[] = ['inbox', 'building', 'outbox', 'shipped', 'retro'];

export type StageEvent = { repository: string; topic: string; prd: number | null; stage: StoredStage; at: string };

export type StageEventDeps = {
  /** STAGE_EVENT_SECRET; unset, every event is refused. */
  secret: string | undefined;
  /** The service role's store: only the service role writes stages. */
  store: () => StageStore;
  /** The workspaces that own a repository (`owner/name`): those whose GitHub org is its owner. */
  workspacesOf: (repository: string) => Promise<string[]>;
  /** Recounts a workspace's PRDs' open outbox questions (../outbox/recount.ts); none, no recount. */
  recount?: (workspace: string, prds: { repository: string; prd: number }[]) => Promise<number>;
  log?: (line: string) => void;
};

export type Reply = { status: number; body: { ok?: true; placed?: number; error?: string } };

const REPOSITORY = /^[\w.-]+\/[\w.-]+$/;

/** A well-formed stage event, or null. */
export function parseStageEvent(value: unknown): StageEvent | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const { repository, topic, prd, stage, at } = value as Record<string, unknown>;
  if (typeof repository !== 'string' || !REPOSITORY.test(repository)) return null;
  if (typeof topic !== 'string' || topic.trim() === '') return null;
  if (prd !== null && !(Number.isInteger(prd) && (prd as number) > 0)) return null;
  if (!EVENT_STAGES.includes(stage as StoredStage)) return null;
  if (typeof at !== 'string' || Number.isNaN(Date.parse(at))) return null;
  return { repository, topic, prd: prd as number | null, stage: stage as StoredStage, at };
}

/** True only for `sha256=<hex>` of the exact body under the secret, compared in constant time. */
export function verifySignature(secret: string, body: string, signature: string | null): boolean {
  if (!signature?.startsWith('sha256=')) return false;
  const expected = Buffer.from(createHmac('sha256', secret).update(body).digest('hex'));
  const given = Buffer.from(signature.slice('sha256='.length));
  return given.length === expected.length && timingSafeEqual(given, expected);
}

const why = (error: unknown) => (error instanceof Error ? error.message.split('\n')[0] : String(error));

export async function receiveStageEvent(
  request: { body: string; headers: Headers },
  { secret, store, workspacesOf, recount, log = console.error }: StageEventDeps,
): Promise<Reply> {
  if (!secret) {
    log('stage event: STAGE_EVENT_SECRET is not set on this deployment, every event is refused');
    return { status: 401, body: { error: 'stage events are not accepted here' } };
  }
  if (!verifySignature(secret, request.body, request.headers.get(STAGE_SIGNATURE_HEADER))) {
    return { status: 401, body: { error: 'bad signature' } };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(request.body);
  } catch {
    return { status: 400, body: { error: 'the body is not JSON' } };
  }
  const event = parseStageEvent(parsed);
  if (!event) return { status: 400, body: { error: 'the body is not a stage event' } };

  try {
    const stages = store();
    let placed = 0;
    for (const workspace of await workspacesOf(event.repository)) {
      const prd = event.prd ?? (await stages.prdByTopic(workspace, event.repository, event.topic));
      if (prd === null) continue;
      await stages.recordStages([{ workspace_id: workspace, repository: event.repository, prd, stage: event.stage, reached_at: event.at }]);
      placed += 1;
      try {
        await recount?.(workspace, [{ repository: event.repository, prd }]);
      } catch (error) {
        log(`stage event: the outbox of ${event.repository}#${prd} was not recounted — ${why(error)}`);
      }
    }
    if (placed === 0) return { status: 202, body: { placed: 0 } };
    return { status: 200, body: { ok: true, placed } };
  } catch (error) {
    log(`stage event: the ${event.stage} of ${event.repository} ${event.prd ? `#${event.prd}` : event.topic} could not be recorded — ${why(error)}`);
    return { status: 500, body: { error: 'the stage could not be recorded' } };
  }
}
