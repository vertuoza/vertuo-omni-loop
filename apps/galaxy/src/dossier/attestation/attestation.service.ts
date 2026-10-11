import { judgeApproval, verdictOf, type ApprovalReply, type ApprovalTree, type ApprovalVerdict, type Drift, type PinnedFile } from 'vertuo-omni-plan/kit/lib/approval/approval.ts';
import { sha256 } from 'vertuo-omni-plan/kit/lib/dossier/folder.ts';
import type { PrdNumber } from 'vertuo-omni-plan/kit/lib/ids.ts';
import type { ApprovalRow, ApprovalVoid } from '../page/approval';
import { stamp } from '../page/dates';
import type { AttestationFacts } from './attestation-facts';
import type { HeadFiles, TargetPull } from './attestation-github';

// The Attestation page's rules (PRD 1612 s4, spec §5): what /prd/<id>/attestation?head=<sha> shows of a
// ◆ PRD's approval in force, read against the files at the head the omni/approved check ran on. The
// judge is the kit's own (`judgeApproval`, kit/lib/approval/approval.ts), so the page, the check and
// `omni approval <n>` never disagree; this module only builds the reply it judges from what the member
// reads (./attestation.repository.ts, through the PRD page's approval code) and hands it a tree of the
// files GitHub answered at that head (./attestation-github.ts). Four states, the gate's:
//
// - approved: the seal, the approver (a member today, an approver of the product), every file `=`;
// - drifted: the seal stands, the build is refused: each changed file `≠` with both hashes, a void
//   naming its push, then `omni approval restore <n>` and Approve again for a member who may approve;
// - waiting: nobody approved it yet;
// - held: the head could not be read (no head named, GitHub down, the App not installed), each file `?`,
//   or the approver left the workspace: never a failure.
//
// The personas' rounds (voice) are appended after approval and never drift it (PRD 1322): their row
// reads `=` when unchanged and `·` (not judged) otherwise. The PRD's target PRs (`Part of <home>#<n>`,
// in its product's other repositories) each show the page's state while open, or `merged`.

/** One pinned file against the head: `=` matches, `≠` drifted, `?` unread, `·` never judged. */
export type PinRow = {
  mark: '=' | '≠' | '?' | '·';
  path: string;
  /** The approved file's sha256, shortened (`9c41…e07b`); null when the approval kept none. */
  pinned: string | null;
  /** What the head holds, shortened, `missing`, or the void's new hash; null when it matches or is unread. */
  now: string | null;
  /** How it drifted (`content`, `whitespace only`, `missing`, `voided by ada's push`); null otherwise. */
  how: string | null;
};

/** A target PR of the PRD: open, it carries the page's state; merged, it says so. */
export type TargetRow = { repo: string; number: number; url: string; state: ApprovalVerdict | 'merged'; draft: boolean };

/** Who approved, when, and whether they hold today: a member of the workspace, an approver of the product
 * (null when the product asks nobody in particular, or that list could not be read). */
export type Approver = { login: string; at: string; member: boolean; productApprover: boolean | null };

export type Attestation = {
  prd: PrdNumber;
  dossier: string;
  home: string;
  /** The head read, as named; null when none was. */
  head: string | null;
  verdict: ApprovalVerdict;
  /** What the seal says: `Approved · pinned`, `Seal stands · build refused`, `Waits for approval`, `Held · not failed`. */
  title: string;
  /** The line under it: why it is held, what drifted, or that nobody approved yet; null when approved. */
  line: string | null;
  /** The short hash the seal carries (the first pinned file's); null with no approval. */
  sealHash: string | null;
  approver: Approver | null;
  /** Who approved, said: `irisa · member of vertuoza ✓ · Mobile approver ✓ · 8 Oct 2026, 14:02 UTC`; null with no approval. */
  who: string | null;
  /** The policy line: who may approve, among whom. */
  policy: string;
  pins: PinRow[];
  /** `omni approval restore <n>` on a drift; null otherwise. */
  restore: string | null;
  /** Whether the viewer gets Approve again: a member allowed to approve, on a drift. */
  canApprove: boolean;
  /** Who approves again, said to a viewer without the button. */
  approvesAgain: string;
  /** The target PRs, or `unread` when GitHub could not list them. */
  targets: TargetRow[] | 'unread';
};

const TITLES: Record<ApprovalVerdict, string> = {
  approved: 'Approved · pinned',
  drifted: 'Seal stands · build refused',
  waiting: 'Waits for approval',
  held: 'Held · not failed',
};

/** `9c41…e07b`: a sha256 as the page shows it. */
export const shortHash = (hash: string): string => (hash.length > 8 ? `${hash.slice(0, 4)}…${hash.slice(-4)}` : hash);
const shortHead = (head: string) => head.slice(0, 7);
const baseName = (path: string) => path.slice(path.lastIndexOf('/') + 1);

/** The policy line: the product's approvers among the workspace's members, or any member. */
function policyOf(facts: AttestationFacts): string {
  const members = facts.workspace ? `${facts.workspace} members` : 'the workspace\'s members';
  const asked = facts.asked !== 'unread' && facts.asked.length > 0;
  if (facts.product && asked) return `Policy: ${facts.product.name} approvers · ${members}.`;
  return `Policy: any of ${members}.`;
}

/** Who approved, when, and whether they hold today, in one line. */
function whoOf(approver: Approver, facts: AttestationFacts): string {
  const workspace = facts.workspace ?? 'the workspace';
  const member = approver.member ? `member of ${workspace} ✓` : `not a member of ${workspace} ✗`;
  const product = facts.product?.name ?? 'the product';
  const approves = approver.productApprover === null ? [] : [approver.productApprover ? `${product} approver ✓` : `not a ${product} approver ✗`];
  return [approver.login, member, ...approves, stamp(approver.at)].join(' · ');
}

/** The approval in force in the kit's reply shape, with its own voids, each pinned file carrying its
 * approved text when the member reads it. Files the approval kept no hash of are left to `?`. */
function replyOf(facts: AttestationFacts, row: ApprovalRow, url: string): ApprovalReply {
  const files: PinnedFile[] = row.files.flatMap((file) => {
    if (file.sha256 === undefined) return [];
    const content = facts.contents.get(file.version_id);
    const pinned = { kind: file.kind, path: file.path, sha256: file.sha256, versionId: file.version_id };
    return [content === undefined ? pinned : { ...pinned, content }];
  });
  const voids = facts.voids.filter((v) => v.approval_id === row.id).map((v) => ({
    pusher: v.pusher_login, kind: v.kind, from: v.from_sha256, to: v.to_sha256, voidedAt: v.voided_at,
  }));
  const member = facts.approvedBy !== null && facts.members.includes(facts.approvedBy);
  return { url, approval: { approver: { login: row.approver_login, member }, approvedAt: row.approved_at, files, voids } };
}

/** The head as the kit's judge reads it: each pinned file at its pinned path. */
function treeOf(files: ReadonlyMap<string, string | null>): ApprovalTree {
  return { fileOf: (file) => file.path, read: (path) => files.get(path) ?? null };
}

/** A voided file's row: the push's old and new hash, and who pushed. */
function voidedPin(path: string, pinned: string | null, last: ApprovalVoid | undefined): PinRow {
  if (!last) return { mark: '≠', path, pinned, now: null, how: 'voided' };
  return { mark: '≠', path, pinned: shortHash(last.from_sha256), now: shortHash(last.to_sha256), how: `voided by ${last.pusher_login}'s push` };
}

/** The head's hash of a file, shortened, or `missing`. */
const nowOf = (content: string | null) => (content === null ? 'missing' : shortHash(sha256(content)));

/** A file's row against the head that was read. */
function headPin(file: ApprovalRow['files'][number], off: Drift | undefined, head: ReadonlyMap<string, string | null>): PinRow {
  if (file.sha256 === undefined) return { mark: '?', path: file.path, pinned: null, now: null, how: null };
  const pinned = shortHash(file.sha256);
  const content = head.get(file.path) ?? null;
  if (off) return { mark: '≠', path: file.path, pinned, now: nowOf(content), how: off.how };
  if (content !== null && sha256(content) === file.sha256) return { mark: '=', path: file.path, pinned, now: null, how: null };
  // Only the personas' rounds differ without drifting: they are never judged.
  return { mark: '·', path: file.path, pinned, now: nowOf(content), how: 'not judged' };
}

/** Each pinned file's row, from the judge's drift and what the head holds (null: unread, each `?`
 * unless a void decides it). */
function pinsOf(row: ApprovalRow, drift: readonly Drift[], head: ReadonlyMap<string, string | null> | null, voids: readonly ApprovalVoid[]): PinRow[] {
  return row.files.map((file): PinRow => {
    const off = drift.find((d) => d.kind === file.kind);
    const pinned = file.sha256 === undefined ? null : shortHash(file.sha256);
    if (off?.how === 'voided') return voidedPin(file.path, pinned, voids.filter((v) => v.kind === file.kind).at(-1));
    if (head === null) return { mark: '?', path: file.path, pinned, now: null, how: null };
    return headPin(file, off, head);
  });
}

/** The line under the seal of a drifted approval: its first drifted file, and how. */
function driftLine(pins: readonly PinRow[], head: string | null): string {
  const first = pins.find((p) => p.mark === '≠');
  if (!first) return 'A pinned file changed since it was approved.';
  if (first.how?.startsWith('voided')) return `${baseName(first.path)} ${first.how}`;
  return `${baseName(first.path)} changed${head ? ` at head ${shortHead(head)}` : ''} · ${first.how ?? 'content'}`;
}

/** Why the head could not be read. */
function heldLine(head: string | null): string {
  if (head === null) return 'No head named: open this page from a pull request\'s omni/approved check.';
  return `Head ${shortHead(head)} could not be read on GitHub: held, not failed.`;
}

/** What the page shows beside the approval, whatever its state. */
type Base = Pick<Attestation, 'prd' | 'dossier' | 'home' | 'head' | 'policy' | 'approvesAgain'>;

/** Who reads it and what GitHub listed: whether `me` may approve (a member, asked by the product or
 * with nobody asked), and the target PRs. */
type Around = { allowed: boolean; targets: readonly TargetPull[] | null };

const targetRows = (targets: readonly TargetPull[] | null, verdict: ApprovalVerdict): TargetRow[] | 'unread' => (targets === null ? 'unread' : targets.map((t) => ({
  repo: t.repo, number: t.number, url: t.url, draft: t.draft, state: t.state === 'merged' ? 'merged' : verdict,
})));

function baseOf(facts: AttestationFacts, head: string | null): Base {
  const { dossier, asked } = facts;
  const someAsked = asked !== 'unread' && asked.length > 0;
  return {
    prd: dossier.prd, dossier: dossier.id, home: dossier.home_repo, head, policy: policyOf(facts),
    approvesAgain: facts.product && someAsked ? `a ${facts.product.name} approver` : 'a member of the workspace',
  };
}

/** Whether `me` may approve: a member, asked by the product or with nobody asked. */
function allowedOf(facts: AttestationFacts, me: string): boolean {
  const { asked } = facts;
  return facts.members.includes(me) && (asked === 'unread' || asked.length === 0 || asked.includes(me));
}

/** Nobody approved it yet. */
function waitingOf(base: Base, around: Around): Attestation {
  return {
    ...base, verdict: 'waiting', title: TITLES.waiting, line: `Nobody approved PRD ${Number(base.prd)} yet.`, sealHash: null,
    approver: null, who: null, pins: [], restore: null, canApprove: false, targets: targetRows(around.targets, 'waiting'),
  };
}

/** Whether the approver is one the product asks; null when it asks nobody, or that could not be read. */
function productApproverOf(facts: AttestationFacts): boolean | null {
  const { asked, approvedBy } = facts;
  return asked === 'unread' || asked.length === 0 || approvedBy === null ? null : asked.includes(approvedBy);
}

/** The line under the seal, by verdict. */
function lineOf(verdict: ApprovalVerdict, refused: string | null, pins: readonly PinRow[], head: string | null): string | null {
  if (verdict === 'drifted') return driftLine(pins, head);
  if (verdict === 'held') return refused ?? heldLine(head);
  return null;
}

/** The head the judge reads: the files GitHub answered, or null when none was named or read. */
const headRead = (head: string | null, files: HeadFiles) => (head !== null && files.kind === 'read' ? files.files : null);

/** The judge's reading of the approval against the head, and the gate's verdict of it: held while the
 * head is unread, unless a void decides it, which drifts whatever the tree holds. */
function judged(base: Base, reply: ApprovalReply, read: ReadonlyMap<string, string | null> | null) {
  const reading = judgeApproval(base.prd, reply, treeOf(read ?? new Map()));
  const voided = reading.drift.some((d) => d.how === 'voided');
  const verdict: ApprovalVerdict = read === null && !voided ? 'held' : verdictOf(reading);
  return { reading, verdict };
}

/** Who approved, from the row and the reply the judge read. */
const approverOf = (facts: AttestationFacts, row: ApprovalRow, reply: ApprovalReply): Approver => ({
  login: row.approver_login, at: row.approved_at, member: reply.approval?.approver.member === true, productApprover: productApproverOf(facts),
});

/** The way out of a drift: the restore command, and Approve again for a member allowed to. */
function fixOf(verdict: ApprovalVerdict, prd: PrdNumber, allowed: boolean): Pick<Attestation, 'restore' | 'canApprove'> {
  if (verdict !== 'drifted') return { restore: null, canApprove: false };
  return { restore: `omni approval restore ${Number(prd)}`, canApprove: allowed };
}

/** The approval in force judged against the head: approved, drifted or held. */
function judgedOf(base: Base, around: Around, facts: AttestationFacts, row: ApprovalRow, files: HeadFiles): Attestation {
  const reply = replyOf(facts, row, `/prd/${base.dossier}`);
  const approver = approverOf(facts, row, reply);
  const read = headRead(base.head, files);
  const { reading, verdict } = judged(base, reply, read);
  const pins = pinsOf(row, verdict === 'drifted' ? reading.drift : [], read, facts.voids.filter((v) => v.approval_id === row.id));
  const refused = reading.state === 'refused' ? `${row.approver_login} is no longer a member of the workspace: held, not failed.` : null;
  return {
    ...base, verdict, title: TITLES[verdict], line: lineOf(verdict, refused, pins, base.head), sealHash: (row.files[0]?.sha256 ?? '').slice(0, 4) || null,
    approver, who: whoOf(approver, facts), pins, ...fixOf(verdict, base.prd, around.allowed), targets: targetRows(around.targets, verdict),
  };
}

/** The PRD's attestation, as `me` reads it, against the files at `head`. */
export function attestationOf(
  facts: AttestationFacts, me: string, head: string | null, files: HeadFiles, targets: readonly TargetPull[] | null,
): Attestation {
  const base = baseOf(facts, head);
  const around = { allowed: allowedOf(facts, me), targets };
  return facts.approval === null ? waitingOf(base, around) : judgedOf(base, around, facts, facts.approval, files);
}

/** What the page reads through: the record as the member, and GitHub as the App (null when this
 * deployment has no App). */
export type AttestationPorts = {
  /** The record as the member reads it; `not-found` when they read no such PRD, and the PRD's number when
   * it was approved in its repository (◇), by its merged phase-0 PR. */
  facts(id: string): Promise<AttestationFacts | 'not-found' | { repoBorn: PrdNumber }>;
  github: {
    headFiles(repo: string, head: string, paths: readonly string[]): Promise<HeadFiles>;
    targets(repos: readonly string[], home: string, prd: PrdNumber): Promise<TargetPull[] | null>;
  } | null;
};

/** What the page shows for dossier `id`: its attestation, not found, or a PRD approved in its repository. */
export type AttestationRead = { kind: 'attestation'; attestation: Attestation } | { kind: 'not-found' } | { kind: 'repo-born'; prd: PrdNumber; page: string };

const HEAD = /^[0-9a-f]{7,40}$/i;

/** The head a query names, when it is a commit's sha; null otherwise. */
export const headOf = (value: string | null | undefined): string | null => (value && HEAD.test(value) ? value.toLowerCase() : null);

/** Reads dossier `id`'s attestation for `me` against `head`; throws when the record cannot be read.
 * GitHub failing leaves the files `?` and the targets unread, never the page. */
export async function readAttestation(ports: AttestationPorts, id: string, me: string, head: string | null): Promise<AttestationRead> {
  const facts = await ports.facts(id);
  if (facts === 'not-found') return { kind: 'not-found' };
  if ('repoBorn' in facts) return { kind: 'repo-born', prd: facts.repoBorn, page: `/prd/${id}` };
  const { dossier, approval } = facts;
  const paths = approval ? approval.files.map((f) => f.path) : [];
  const repos = (facts.product?.repos ?? []).filter((r) => r.toLowerCase() !== dossier.home_repo.toLowerCase());
  const github = ports.github;
  const [files, targets] = await Promise.all([
    github && head !== null && paths.length > 0 ? github.headFiles(dossier.home_repo, head, paths) : Promise.resolve<HeadFiles>({ kind: 'unread' }),
    github ? github.targets(repos, dossier.home_repo, dossier.prd) : Promise.resolve(null),
  ]);
  return { kind: 'attestation', attestation: attestationOf(facts, me, head, files, targets) };
}
