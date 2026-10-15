// A product roadmap's record on its page (PRD 2011, s3): the roadmap born on the server (`mobile-R3`) is a
// dossier of kind `roadmap`, whose every push added a version of each part that changed. As pure functions
// of what the viewer reads (./RoadmapRecordRead.ts), this gives:
//
// - its versions, a list per part (the document, its PRD rows, its human work, its prerequisites), the
//   newest first, and the one shown (`?part=` and `?v=`, the latest document by default);
// - its approval, as a ◆ PRD's (./approval.ts): waiting for approval, approved by whom and when, drifted ·
//   approve again once a newer roadmap.md was pushed, or voided · approve again. It pins roadmap.md alone
//   (supabase/migrations/20261210090000_product_roadmaps.sql, dossier_approve()), so only a newer document
//   drifts it; a newer set of rows never does;
// - its status word, as a PRD reads: `held` until it is approved, `building` once approved and a PRD of it
//   is under way, `approved` before that, `drifted` once its approval no longer holds.
import { stamp } from './dates';
import { judgeApproval, type ApprovalRead, type ApprovalVoid } from './approval';

/** The parts of a roadmap a push versions, in the order a push sends them. */
const ROADMAP_PARTS = ['roadmap', 'roadmap-prds', 'roadmap-human-work', 'roadmap-prerequisites'] as const;
export type RoadmapPart = (typeof ROADMAP_PARTS)[number];

export const PART_LABELS: Readonly<Record<RoadmapPart, string>> = {
  roadmap: 'Document', 'roadmap-prds': 'PRD rows', 'roadmap-human-work': 'Human work', 'roadmap-prerequisites': 'Prerequisites',
};

/** What each part is called as a file, for the approval's pinned path. */
const PART_FILES: Readonly<Record<RoadmapPart, string>> = {
  roadmap: 'roadmap.md', 'roadmap-prds': 'prds.json', 'roadmap-human-work': 'human-work.json', 'roadmap-prerequisites': 'prerequisites.json',
};

export const isRoadmapPart = (value: unknown): value is RoadmapPart => ROADMAP_PARTS.some((part) => part === value);

/** A version of the roadmap without its content. */
export type RoadmapVersion = { id: string; kind: RoadmapPart; bytes: number; source: 'kit' | 'github'; created_at: string };

/** What the page reads of the record: its dossier, its versions (oldest first), its approval in force and
 * the voids, the members its product asks to approve, and the text of the version shown. */
export type RoadmapRecordRead = {
  dossier: string;
  versions: readonly RoadmapVersion[];
  approval: ApprovalRead;
  /** The voids of its approvals, or null when they could not be read. */
  voids: readonly ApprovalVoid[] | null;
  /** The members asked to approve (none: any member may), or `unread`. */
  asked: readonly string[] | 'unread';
  /** The text of the version shown, null when it could not be read. */
  text: string | null;
};

/** What `?part=` and `?v=` ask for: a part (the document by default) and a version number of it (the latest by default). */
export type VersionPick = { part: RoadmapPart; version: number | null };

export function versionPickOf(part: string | null | undefined, version: string | null | undefined): VersionPick {
  const n = version !== null && version !== undefined && /^[1-9]\d{0,5}$/.test(version) ? Number(version) : null;
  return { part: isRoadmapPart(part) ? part : 'roadmap', version: n };
}

export type RoadmapApprovalState = 'waiting' | 'approved' | 'drifted' | 'voided' | 'unread';

const WORDS: Record<RoadmapApprovalState, string> = {
  waiting: 'waiting for approval',
  approved: 'approved',
  drifted: 'drifted · approve again',
  voided: 'voided · approve again',
  unread: 'The approval could not be read. Reload the page in a moment.',
};

/** The seal an approval in force shows: who approved the roadmap, when, and each pinned file's short hash. */
export type RoadmapSeal = { roadmap: string | null; approver: string; at: string; files: Array<{ path: string; hash: string | null }> };

export type RoadmapApprovalView = {
  state: RoadmapApprovalState;
  words: string;
  detail: string | null;
  changed: string[];
  /** Whether the viewer gets the Approve button. */
  canApprove: boolean;
  dossier: string;
  seal: RoadmapSeal | null;
};

/** The approval of the roadmap as its page shows it to `me` (a member of its workspace, or null). */
export function roadmapApprovalView(read: RoadmapRecordRead, me: string | null, roadmap: string | null): RoadmapApprovalView {
  const asked = read.asked;
  const allowed = me !== null && (asked === 'unread' || asked.length === 0 || asked.includes(me));
  const view = (state: RoadmapApprovalState, detail: string | null = null, changed: string[] = [], seal: RoadmapSeal | null = null): RoadmapApprovalView => ({
    state, words: WORDS[state], detail, changed, canApprove: allowed && (state === 'waiting' || state === 'drifted' || state === 'voided'),
    dossier: read.dossier, seal,
  });
  const { approval, voids } = read;
  if (approval === 'unread' || voids === null) return view('unread');
  if (approval === null) return view('waiting');
  const judged = judgeApproval(approval, voids, read.versions);
  if (judged.state !== 'approved') return view(judged.state, judged.detail, judged.changed);
  return view('approved', judged.detail, [], { roadmap, approver: approval.approver_login, at: judged.at, files: judged.files });
}

/** The status word of a roadmap, read as a PRD's is: held until approved, building once a PRD of it is under way. */
export type RoadmapStatus = 'held' | 'approved' | 'building' | 'drifted';

const UNDER_WAY: readonly string[] = ['building', 'outbox', 'ready'];

export function roadmapStatus(state: RoadmapApprovalState, prdStates: readonly string[]): RoadmapStatus {
  if (state === 'drifted' || state === 'voided') return 'drifted';
  if (state !== 'approved') return 'held';
  return prdStates.some((s) => UNDER_WAY.includes(s)) ? 'building' : 'approved';
}

/** One version in a part's list. */
export type VersionLine = { id: string; number: number; label: string; href: string; current: boolean };

/** A part of the roadmap with its versions, the newest first. */
export type PartView = { part: RoadmapPart; label: string; file: string; count: number; lines: VersionLine[] };

/** The record's versions by part, each version linking to itself under the Versions tab; the one shown is current. */
export function versionsView(versions: readonly RoadmapVersion[], pick: VersionPick, href: (part: RoadmapPart, version: number | null) => string): PartView[] {
  return ROADMAP_PARTS.map((part) => {
    const mine = versions.filter((v) => v.kind === part);
    const shown = pick.part === part ? Math.min(pick.version ?? mine.length, mine.length) : null;
    const lines = mine.map((v, i): VersionLine => ({
      id: v.id, number: i + 1, label: `v${i + 1} · ${stamp(v.created_at)} · ${v.source}`, href: href(part, i + 1), current: shown === i + 1,
    })).reverse();
    return { part, label: PART_LABELS[part], file: PART_FILES[part], count: mine.length, lines };
  });
}

/** The version `pick` names, or null when the part has none (or the number is beyond them). */
export function shownVersion(versions: readonly RoadmapVersion[], pick: VersionPick): RoadmapVersion | null {
  const mine = versions.filter((v) => v.kind === pick.part);
  return mine[(pick.version ?? mine.length) - 1] ?? null;
}
