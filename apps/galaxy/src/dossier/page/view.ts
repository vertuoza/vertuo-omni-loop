// /prd/<id>, the page to share (PRD 216's spec, "The pages"), as pure functions of the rows the viewer
// may read, the workspace's members and what the address picks: the header (PRD #n or DRAFT, the
// title, the repository chips, who opened it and when), the artifact tabs, and each artifact's
// versions, newest first, as the version picker lists them (`v3 · 27 Sep · Pierre (kit)`,
// `v4 · 28 Sep · commit a1b2c3d (github)`). A version's number is its place among its kind's versions,
// oldest first, as the version rule numbers it. The tab and the version live in the address
// (`?tab=spec&v=2`), so every view is a link and the page works before any script runs.
import { nameOf, type Member } from '../../ask/page/question';
import { isDossierKind, type DossierKind, type DossierRow, type DossierVersionRow } from '../store';

/** The artifact tabs, in order: the page to look at first, then what to read. */
export const TABS: readonly DossierKind[] = ['before-after', 'spec', 'plan'];

export const TAB_LABELS: Readonly<Record<DossierKind, string>> = { 'before-after': 'Before/after', spec: 'Spec', plan: 'Plan' };

/** What the address picks: a tab, and a version of its artifact (null: the latest). */
export type DossierPick = { tab: DossierKind; version: number | null };

type Query = Record<string, string | string[] | undefined>;

const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) ?? null;
const VERSION = /^[1-9]\d{0,8}$/;

export function readPick(query: Query): DossierPick {
  const tab = one(query.tab);
  const version = one(query.v);
  return { tab: isDossierKind(tab) ? tab : 'before-after', version: version !== null && VERSION.test(version) ? Number(version) : null };
}

/** The page's own address, the one Copy link gives. */
export const dossierPath = (id: string) => `/prd/${encodeURIComponent(id)}`;

/** Where a version of the before/after page is served, sandboxed. */
export const sandboxPath = (id: string, number: number) => `${dossierPath(id)}/v/${number}/page`;

function hrefOf(id: string, tab: DossierKind, version: number | null) {
  const query = new URLSearchParams();
  if (tab !== 'before-after') query.set('tab', tab);
  if (version !== null) query.set('v', String(version));
  return String(query) ? `${dossierPath(id)}?${query}` : dossierPath(id);
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const pad = (n: number) => String(n).padStart(2, '0');

/** `27 Sep`, in UTC: the same on the server and in any browser. */
export function shortDay(iso: string): string {
  const at = new Date(iso);
  return `${at.getUTCDate()} ${MONTHS[at.getUTCMonth()]}`;
}

/** `27 Sep 2026, 09:12 UTC`. */
export function stamp(iso: string): string {
  const at = new Date(iso);
  return `${shortDay(iso)} ${at.getUTCFullYear()}, ${pad(at.getUTCHours())}:${pad(at.getUTCMinutes())} UTC`;
}

/** Who sent a version: the member who pushed it (kit), or the commit the fallback read it at (github). */
export function versionSource(version: Pick<DossierVersionRow, 'source' | 'uploaded_by' | 'commit_sha'>, members: Member[]): string {
  return version.source === 'github'
    ? `commit ${(version.commit_sha ?? '').slice(0, 7)} (github)`
    : `${nameOf(version.uploaded_by, members)} (kit)`;
}

export type DossierRead = { dossier: DossierRow; versions: DossierVersionRow[]; members: Member[] };

export type TabEntry = { kind: DossierKind; label: string; latest: number | null; href: string; current: boolean };

export type VersionEntry = {
  id: string;
  number: number;
  label: string;
  href: string;
  current: boolean;
  /** The sandboxed route of a before/after version; null for the others. */
  frame: string | null;
};

export type DossierView = {
  id: string;
  /** `PRD #216`, or `DRAFT`. */
  heading: string;
  draft: boolean;
  title: string;
  repos: string[];
  /** `opened by Pierre · 27 Sep 2026, 09:12 UTC`, or `read from GitHub · …` when the fallback made it. */
  opened: string;
  /** The page's own path, for Copy link. */
  link: string;
  /** The viewer opened this draft: they may delete it. Nobody deletes a numbered dossier. */
  canDelete: boolean;
  tabs: TabEntry[];
  tab: DossierKind;
  /** The tab's versions, newest first. */
  versions: VersionEntry[];
  /** The version the tab shows: the picked one, else the latest; null when there is none yet. */
  shown: VersionEntry | null;
};

export function dossierView({ dossier, versions, members }: DossierRead, me: string | null, pick: DossierPick): DossierView {
  const ofKind = (kind: DossierKind) => versions.filter((v) => v.kind === kind);
  const tab = pick.tab;
  const mine = ofKind(tab);
  const picked = pick.version !== null && pick.version <= mine.length ? pick.version : mine.length;
  const entries = mine.map((version, i): VersionEntry => {
    const number = i + 1;
    return {
      id: version.id,
      number,
      label: `v${number} · ${shortDay(version.created_at)} · ${versionSource(version, members)}`,
      href: hrefOf(dossier.id, tab, number),
      current: number === picked,
      frame: tab === 'before-after' ? sandboxPath(dossier.id, number) : null,
    };
  }).reverse();
  const opener = dossier.opened_by === null ? 'read from GitHub' : `opened by ${nameOf(dossier.opened_by, members)}`;
  return {
    id: dossier.id,
    heading: dossier.prd === null ? 'DRAFT' : `PRD #${dossier.prd}`,
    draft: dossier.prd === null,
    title: dossier.title,
    repos: [dossier.home_repo],
    opened: `${opener} · ${stamp(dossier.created_at)}`,
    link: dossierPath(dossier.id),
    canDelete: dossier.prd === null && me !== null && dossier.opened_by === me,
    tabs: TABS.map((kind) => ({
      kind,
      label: TAB_LABELS[kind],
      latest: ofKind(kind).length || null,
      href: hrefOf(dossier.id, kind, null),
      current: kind === tab,
    })),
    tab,
    versions: entries,
    shown: entries.find((e) => e.current) ?? null,
  };
}
