// A PRD's approval in force, read against the tree (PRD 1299, s4). The server keeps one append-only
// row per approval (`GET /api/dossiers/approval?repo=&prd=` answers the latest, with the dossier's
// link); this module judges it against the files of the tree being read, in one of five states:
//
// | state         | when                                                                      |
// |---------------|---------------------------------------------------------------------------|
// | `approved`    | an approval is in force, its approver a member today, every file matches  |
// | `pending`     | no approval yet                                                           |
// | `drifted`     | a push voided it, or a pinned file differs from the tree's, or is missing |
// | `unreachable` | the call got no answer (the client waits 5 seconds and refreshes once)    |
// | `refused`     | the approver left the workspace, or the page answered an error            |
//
// Files are paired by kind, never by path: a kind the PRD's folder keeps (spec, plan, before-after,
// voice) is read where the layout keeps it today, so `omni ship` moving the folder trips nothing; any
// other kind (a scenario) is read at its pinned path. A file is hashed as `omni dossier push` hashes
// it (`sha256` of its UTF-8 text). A drift says `whitespace only` when the server sent the approved
// text and it differs from the tree's in spacing alone, `content` otherwise: both refuse.
//
// Since PRD 1322 an approval carries the voids `omni dossier push` left on it (`voids`, oldest first;
// a server before it sends none): an approval with a void is no longer in force, so it reads
// `drifted`, one line per void naming the push, whatever the tree holds.
import { existsSync, readFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { z } from 'zod';
import { AskCallError } from '../ask/client.ts';
import { ARTIFACT_KINDS, sha256 } from '../dossier/folder.ts';
import type { Layout } from '../layout.ts';
import type { PrdNumber } from '../ids.ts';

export type ApprovalState = 'approved' | 'pending' | 'drifted' | 'unreachable' | 'refused';

const text = z.string().min(1);

const PinnedFileSchema = z.object({ kind: text, path: text, sha256: text, versionId: text, content: z.string().optional() });

const VoidSchema = z.object({ pusher: text, kind: text, from: text, to: text, voidedAt: text });

const ApprovalSchema = z.object({
  approver: z.object({ login: text, member: z.boolean() }),
  approvedAt: text,
  files: z.array(PinnedFileSchema),
  voids: z.array(VoidSchema).optional(),
});

const ApprovalReplySchema = z.object({ url: text, approval: ApprovalSchema.nullable() });

/** One approved file: its kind, its path when approved, its hash and its dossier version. */
export type PinnedFile = z.infer<typeof PinnedFileSchema>;
/** The approval in force: who approved, whether they are a member today, when, and what. */
export type Approval = z.infer<typeof ApprovalSchema>;
/** What the approval route answers: the dossier's link and the approval in force, or none yet. */
export type ApprovalReply = z.infer<typeof ApprovalReplySchema>;

/** A pinned file the tree does not hold as approved: its kind, its file on the tree, and how; `voided`
 * when a push changed it on the server. */
export type Drift = { kind: string; file: string; how: 'content' | 'whitespace only' | 'missing' | 'voided' };

/** The approval read against the tree: its state, the lines that say it, and what they rest on. */
export type ApprovalReading = { state: ApprovalState; lines: string[]; url: string | null; approval: Approval | null; drift: Drift[] };

/** The line of a state the server never got to judge. */
export const UNREACHABLE_LINE = 'server unreachable · held, not failed';

/** The approval route's reply, or null when it is not one. */
export function parseApprovalReply(body: unknown): ApprovalReply | null {
  const parsed = ApprovalReplySchema.safeParse(body);
  return parsed.success ? parsed.data : null;
}

/** Where the tree keeps a pinned file today: the layout's file for a kind the folder keeps, else the
 * pinned path (also when the PRD has no folder). */
export function treeFileOf(ctx: { layout: Layout }, prd: PrdNumber, file: Pick<PinnedFile, 'kind' | 'path'>): string {
  const kept = ARTIFACT_KINDS.find((entry) => entry.kind === file.kind);
  if (!kept || !ctx.layout.whereIs(prd)) return file.path;
  return kept.pathOf(ctx.layout, prd) ?? file.path;
}

const squeezed = (content: string): string => content.replace(/\s+/g, '');

/** How the tree's copy of `file` differs from the approved one, or null when it matches. */
function driftOf(ctx: { root: string; layout: Layout }, prd: PrdNumber, file: PinnedFile): Drift | null {
  const tree = treeFileOf(ctx, prd, file);
  const absolute = join(ctx.root, tree);
  if (!existsSync(absolute)) return { kind: file.kind, file: tree, how: 'missing' };
  const content = readFileSync(absolute, 'utf8');
  if (sha256(content) === file.sha256) return null;
  const spacing = file.content !== undefined && squeezed(file.content) === squeezed(content);
  return { kind: file.kind, file: tree, how: spacing ? 'whitespace only' : 'content' };
}

/** The approval in force judged against the tree being read. */
export function judgeApproval(ctx: { root: string; layout: Layout }, prd: PrdNumber, reply: ApprovalReply): ApprovalReading {
  const { url, approval } = reply;
  const reading = (state: ApprovalState, lines: string[], drift: Drift[] = []): ApprovalReading => ({ state, lines, url, approval, drift });
  if (!approval) return reading('pending', [`PRD ${Number(prd)} waits for approval: ${url}`]);
  const voids = approval.voids ?? [];
  if (voids.length > 0) {
    const fileOf = (kind: string) => {
      const file = approval.files.find((f) => f.kind === kind);
      return file ? treeFileOf(ctx, prd, file) : kind;
    };
    const lines = voids.map((v) =>
      `≠ ${basename(fileOf(v.kind))} · voided by ${v.pusher}'s push ${v.from.slice(0, 7)}→${v.to.slice(0, 7)} · ✗ refuse · approve again: ${url}`);
    return reading('drifted', lines, voids.map((v) => ({ kind: v.kind, file: fileOf(v.kind), how: 'voided' })));
  }
  const { login, member } = approval.approver;
  if (!member) return reading('refused', [`approver ${login} is not a workspace member`]);
  // The personas' rounds (voice) are appended by the loop after approval, its shipped round included:
  // a changed voice never drifts an approval (PRD 1322).
  const drift = approval.files.filter((file) => file.kind !== 'voice').flatMap((file) => driftOf(ctx, prd, file) ?? []);
  if (drift.length > 0) {
    return reading('drifted', drift.map((d) => `≠ ${basename(d.file)} · ${d.how} · ✗ refuse · restore it, or approve again: ${url}`), drift);
  }
  return reading('approved', [`approved by ${login} · ${approval.approvedAt}`]);
}

/** A reading the server did not judge: `unreachable` when the call got no answer, `refused` with its
 * status when the page answered an error (`malformed reply` for an answer that is no approval). */
export function failedReading(error: unknown): ApprovalReading {
  if (!(error instanceof AskCallError)) throw error;
  const none = { url: null, approval: null, drift: [] };
  if (error.status === null) return { state: 'unreachable', lines: [UNREACHABLE_LINE], ...none };
  return { state: 'refused', lines: [`refused (${error.status})`], ...none };
}

/** Asks the approval route through `call` and judges its reply against the tree. */
export async function readApproval(ctx: { root: string; layout: Layout }, prd: PrdNumber, call: () => Promise<unknown>): Promise<ApprovalReading> {
  let body: unknown;
  try {
    body = await call();
  } catch (error) {
    return failedReading(error);
  }
  const reply = parseApprovalReply(body);
  if (!reply) return { state: 'refused', lines: ['refused (malformed reply)'], url: null, approval: null, drift: [] };
  return judgeApproval(ctx, prd, reply);
}
