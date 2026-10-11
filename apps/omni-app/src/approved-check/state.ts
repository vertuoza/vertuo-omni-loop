// The approved check's judgement (PRD 1548 s3), pure: from the product PRD a target feature PR names,
// the approval in force with the dossier's latest versions, and whether the server could be read, to the
// check run's conclusion and its one line.
//
// | state      | conclusion | when                                                                    |
// |------------|------------|-------------------------------------------------------------------------|
// | `building` | success    | an approval is in force, its approver a member today, every pin matches |
// | `drifted`  | failure    | a push voided the approval, or a pinned file's latest version differs   |
// | `held`     | neutral    | the record could not be read: held, never failed                        |
// | `pending`  | failure    | nobody approved the PRD yet                                             |
// | `refused`  | failure    | the approver is no longer a member of the PRD's workspace               |
// | `unknown`  | failure    | no product PRD of that id holds this pull request's repository          |
//
// Files are paired by kind, as the kit pairs them (kit/lib/approval/approval.ts): a pinned file drifts
// when the latest version of its kind hashes otherwise, `whitespace only` when the two texts differ in
// spacing alone, `content` otherwise; the personas' voice is appended after approval and never drifts.
// A drift names the file and the commit its latest version was pushed from (or the version itself, when
// the push named no commit).
import { basename } from 'node:path';

/** A product PRD as a pull request's body names it, `Part of mobile-12`: its product's key and its number. */
export type ProductPrdRef = { key: string; seq: number; id: string };

/** A pinned file of the approval in force: its kind, its path, its hash and version, its approved text. */
export type PinnedFile = { kind: string; path: string; sha256: string; versionId: string; content: string | null };

/** A push that voided the approval (PRD 1322). */
export type ApprovalVoid = { pusher: string; kind: string; from: string; to: string; voidedAt: string };

/** The latest version of one kind of the dossier. */
export type LatestVersion = { kind: string; sha256: string; versionId: string; commitSha: string | null; content: string | null };

/** The approval in force: who approved, whether they are a member today, when, what, and its voids. */
export type ApprovalInForce = {
  approver: { login: string; member: boolean };
  approvedAt: string;
  files: PinnedFile[];
  voids: ApprovalVoid[];
};

/** A product PRD's record as the server keeps it: its dossier, its approval in force (or none), its latest versions. */
export type ApprovalRecord = { dossierId: string; approval: ApprovalInForce | null; latest: LatestVersion[] };

/** What reading the record gave: the record (null when there is no such PRD for this repository), or why it was not read. */
export type RecordReading = { reachable: true; record: ApprovalRecord | null } | { reachable: false; since: string };

export type ApprovedState = 'building' | 'drifted' | 'held' | 'pending' | 'refused' | 'unknown';

/** A pinned file the latest versions no longer hold as approved, and how. */
export type PinDrift = { file: string; how: 'content' | 'whitespace only' | 'missing' | 'voided'; where: string | null };

/** The check run the state asks for. */
export type ApprovedVerdict = {
  state: ApprovedState;
  conclusion: 'success' | 'failure' | 'neutral';
  title: string;
  summary: string;
  dossierId: string | null;
  drift: PinDrift[];
};

/** A product key (supabase/migrations/20261203090000_product_prd_ids.sql), then its PRD's number. */
const PART_OF = /(?:^|[^\w-])Part of ([a-z][a-z0-9]*(?:-[a-z][a-z0-9]*)*)-([1-9]\d{0,9})(?![\w-])/;
const KEY_MAX = 40;
const SEQ_MAX = 2 ** 31 - 1;

/** The product PRD a pull request's body says it is part of, or null when it names none. */
export function productPrdOf(body: string | null | undefined): ProductPrdRef | null {
  const match = PART_OF.exec(body ?? '');
  if (!match) return null;
  const [, key = '', digits = ''] = match;
  const seq = Number(digits);
  if (key.length > KEY_MAX || seq > SEQ_MAX) return null;
  return { key, seq, id: `${key}-${seq}` };
}

const squeezed = (content: string): string => content.replace(/\s+/g, '');

/** Where a latest version came from: its commit's short hash, else its version's. */
function whereOf(version: LatestVersion): string {
  return version.commitSha ? version.commitSha.slice(0, 7) : `version ${version.versionId.slice(0, 8)}`;
}

/** How the latest version of `pin`'s kind differs from it, or null when it matches. */
function driftOf(pin: PinnedFile, latest: readonly LatestVersion[]): PinDrift | null {
  const file = basename(pin.path);
  const now = latest.find((version) => version.kind === pin.kind);
  if (!now) return { file, how: 'missing', where: null };
  if (now.sha256 === pin.sha256) return null;
  const spacing = pin.content !== null && now.content !== null && squeezed(pin.content) === squeezed(now.content);
  return { file, how: spacing ? 'whitespace only' : 'content', where: whereOf(now) };
}

/** Every pin the record no longer holds as approved: each one a push voided, then each whose latest version differs. */
function driftsOf(approval: ApprovalInForce, latest: readonly LatestVersion[]): PinDrift[] {
  const out: PinDrift[] = [];
  const named = new Set<string>();
  for (const pin of approval.files.filter((file) => file.kind !== 'voice')) {
    const drift = driftOf(pin, latest);
    if (drift) {
      out.push(drift);
      named.add(pin.kind);
    }
  }
  for (const voided of approval.voids) {
    if (named.has(voided.kind)) continue;
    named.add(voided.kind);
    const pin = approval.files.find((file) => file.kind === voided.kind);
    out.push({ file: pin ? basename(pin.path) : voided.kind, how: 'voided', where: `${voided.pusher}'s push` });
  }
  return out;
}

/** One drift as the check's line says it. */
function driftLine(drift: PinDrift): string {
  if (drift.how === 'voided') return `≠ ${drift.file} · voided by ${drift.where ?? 'a push'}`;
  if (drift.how === 'missing') return `≠ ${drift.file} · missing`;
  return `≠ ${drift.file} in ${drift.where ?? 'the dossier'} · ${drift.how}`;
}

/** The pinned files beside today's, as the summary lists them. */
function pinsTable(approval: ApprovalInForce, latest: readonly LatestVersion[]): string[] {
  const rows = approval.files.map((pin) => {
    const now = latest.find((version) => version.kind === pin.kind);
    const today = now ? now.sha256.slice(0, 12) : '—';
    const same = now?.sha256 === pin.sha256 ? '✓' : '≠';
    return `| ${basename(pin.path)} | \`${pin.sha256.slice(0, 12)}\` | \`${today}\` | ${same} |`;
  });
  return ['| file | approved | today | |', '|---|---|---|---|', ...rows];
}

/** The approved check's verdict for PRD `prd`, from what reading its record gave. */
export function approvedVerdict(prd: ProductPrdRef, reading: RecordReading): ApprovedVerdict {
  if (!reading.reachable) {
    const title = `held · server unreachable since ${reading.since}`;
    const summary = `The record of ${prd.id} could not be read: held, not failed. The check is posted again once the server answers.`;
    return { state: 'held', conclusion: 'neutral', title, summary, dossierId: null, drift: [] };
  }
  const { record } = reading;
  if (!record) {
    const title = `unknown · no product PRD ${prd.id} holds this repository`;
    const summary = `This pull request says it is part of ${prd.id}, but no product keyed \`${prd.key}\` that holds this repository has a PRD ${prd.seq}.`;
    return { state: 'unknown', conclusion: 'failure', title, summary, dossierId: null, drift: [] };
  }
  const { dossierId, approval, latest } = record;
  const verdict = (state: ApprovedState, conclusion: ApprovedVerdict['conclusion'], title: string, lines: string[], drift: PinDrift[] = []): ApprovedVerdict =>
    ({ state, conclusion, title, summary: lines.join('\n'), dossierId, drift });
  if (!approval) return verdict('pending', 'failure', `pending · ${prd.id} waits for approval`, [`Nobody approved ${prd.id} yet.`]);

  const { login, member } = approval.approver;
  const attestation = [
    `Approved by **${login}** (${member ? 'a member of the workspace' : 'no longer a member'}) at ${approval.approvedAt}.`,
    '',
    ...pinsTable(approval, latest),
  ];
  const drift = driftsOf(approval, latest);
  if (drift.length > 0) {
    const lines = drift.map(driftLine);
    return verdict('drifted', 'failure', `drifted · ${lines[0] ?? ''}`, [...lines, '', 'Restore the file, or approve again on the PRD page.', '', ...attestation], drift);
  }
  if (!member) return verdict('refused', 'failure', `refused · approver ${login} is not a workspace member`, attestation);
  const pinned = approval.files.length;
  return verdict('building', 'success', `building · ${pinned} of ${pinned} pinned`, attestation);
}
