// The outbox the omni-loop App sends the page (PRD 251, "The App sends the outbox"): what its
// outbox check evaluated on a feature pull request — the numbering its comment carries, the open
// items (each file verbatim), the adopted ones (their item text), what the replies say that nobody has
// settled yet, and the settled entries. The App builds it in apps/omni-app/src/relay/relay.mjs; this
// schema is the page's side of that contract, checked at the boundary before anything is stored.
//
// A field the App adds later is dropped rather than refused, so the App can move first.
import { z } from 'zod';

/** The largest body the page takes. */
export const OUTBOX_MAX_BYTES = 2 * 1024 * 1024;

const count = z.number().int().positive();
const id = z.string().min(1).max(200);
const text = z.string().max(512 * 1024);
const time = z.string().datetime({ offset: true });

export const PR_STATES = ['open', 'merged', 'closed'] as const;
export const DOORS = ['page', 'terminal', 'github'] as const;

export const NumberingEntry = z.object({ number: count, id, since: z.string().max(64) });
export const OpenItem = z.object({ number: count, id, rank: z.string().min(1).max(40), text });
export const AdoptedItem = z.object({ number: count, id, text });
export const PendingAnswer = z.object({
  number: count,
  id,
  text: z.string().max(16384),
  by: z.string().max(100),
  at: z.string().max(64).nullable(),
  url: z.string().max(500).nullable(),
  via: z.enum(DOORS),
});
export const SettledEntry = z.object({
  number: count.nullable(),
  id,
  verdict: z.string().min(1).max(40),
  approvedBy: z.string().max(100).nullable(),
  approvedAt: z.string().max(64).nullable(),
  channel: z.string().max(200).nullable(),
  channelUrl: z.string().max(500).nullable(),
  answer: text,
});

export const OutboxBody = z.object({
  repo: z.string().max(200).regex(/^[\w.-]+\/[\w.-]+$/, 'owner/name'),
  prd: count.max(2 ** 31 - 1),
  pr: z.object({
    number: count.max(2 ** 31 - 1),
    url: z.string().url().max(500),
    headSha: z.string().regex(/^[0-9a-f]{7,64}$/, 'a commit SHA'),
    state: z.enum(PR_STATES),
  }),
  evaluatedAt: time,
  numbering: z.array(NumberingEntry),
  open: z.array(OpenItem),
  adopted: z.array(AdoptedItem),
  pending: z.array(PendingAnswer),
  settled: z.array(SettledEntry),
});

export type OutboxBody = z.infer<typeof OutboxBody>;

/** What the page keeps of a body: the outbox itself, the pull request and the key kept apart. */
export type StoredOutbox = Pick<OutboxBody, 'numbering' | 'open' | 'adopted' | 'pending' | 'settled'>;

export const storedOutbox = ({ numbering, open, adopted, pending, settled }: OutboxBody): StoredOutbox =>
  ({ numbering, open, adopted, pending, settled });
