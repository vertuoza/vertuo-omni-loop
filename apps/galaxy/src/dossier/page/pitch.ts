// The Pitch tab of /prd/<id> (PRD 859 s3), as pure functions of the pitches the viewer reads
// (../../pitch/store.ts, written by `omni pitch push`): the tab appears once the dossier holds a pitch.
// It shows the latest pitch per audience, Customers first: its slide, the 16:9 video's player, a download
// per file of the five, and Copy GIF link (the stable link, which opens without signing in). A picker per
// audience lists its pitches by date, newest first; picking one (`?tab=pitch&pitch=<id>`) shows it in
// its audience's place, the other audience keeping its latest. The files' links are signed for the
// viewer by the route (./pitch-read.ts), for the shown pitches only, so the bucket's rules decide who
// sees what; a link that could not be signed reads as missing, never as an error.
import { nameOf, type Member } from '../../ask/page/question';
import { AUDIENCES, PITCH_FILE_NAMES, PITCH_GIF, type Audience, type Look, type PitchRunRow } from '../../pitch/store';
import { shortDay, stamp } from './dates';

/** What the route read: every pitch the viewer may read, newest first, and for the shown ones (none when
 * it was not read for, as on another tab) their files' signed links, by run id then file name; a name
 * missing or null could not be signed. */
export type PitchRead = {
  runs: PitchRunRow[];
  links: Record<string, Record<string, string | null>>;
};

export const AUDIENCE_LABELS: Readonly<Record<Audience, string>> = { customers: 'Customers', inside: 'Inside' };
export const LOOK_LABELS: Readonly<Record<Look, string>> = { arcade: 'Arcade poster', keynote: 'Clean keynote' };

/** One file of the shown pitch: its name and signed link, null when it could not be signed. */
export type PitchDownload = { name: string; href: string | null };

/** One entry of an audience's picker. */
export type PitchVersion = { id: string; label: string; current: boolean };

/** The shown pitch of one audience. */
export type PitchAudienceView = {
  audience: Audience;
  label: string;
  id: string;
  /** `1 Oct 2026, 14:05 UTC`. */
  at: string;
  look: string;
  commit: string;
  kicker: string;
  hook: string;
  benefit: string;
  closing: string;
  /** slide.png's and pitch.mp4's signed links, null when they could not be signed. */
  slide: string | null;
  video: string | null;
  downloads: PitchDownload[];
  /** The GIF's stable link, as a path on this host: `/api/pitches/<id>/pitch.gif`. */
  gif: string;
  /** Every pitch of the audience, newest first. */
  versions: PitchVersion[];
};

export type PitchView = { audiences: PitchAudienceView[] };

/** The GIF's stable link of a pitch, as a path on this host. */
export const pitchGifPath = (runId: string) => `/api/pitches/${runId}/${PITCH_GIF}`;

/** The pitch each audience shows: the one picked when it is of that audience, else its newest. `runs`
 * is newest first; an audience without a pitch is left out. */
export function shownPitches(runs: readonly PitchRunRow[], picked: string | null): PitchRunRow[] {
  return AUDIENCES.flatMap((audience) => {
    const own = runs.filter((r) => r.audience === audience);
    const shown = own.find((r) => r.id === picked) ?? own[0];
    return shown ? [shown] : [];
  });
}

function audienceView(run: PitchRunRow, own: readonly PitchRunRow[], links: Record<string, string | null>, members: Member[]): PitchAudienceView {
  const link = (name: string) => links[name] ?? null;
  return {
    audience: run.audience,
    label: AUDIENCE_LABELS[run.audience],
    id: run.id,
    at: stamp(run.created_at),
    look: LOOK_LABELS[run.look],
    commit: run.commit_sha.slice(0, 7),
    kicker: run.kicker,
    hook: run.hook,
    benefit: run.benefit,
    closing: run.closing,
    slide: link('slide.png'),
    video: link('pitch.mp4'),
    downloads: PITCH_FILE_NAMES.map((name) => ({ name, href: link(name) })),
    gif: pitchGifPath(run.id),
    versions: own.map((row) => {
      const by = row.created_by ? ` · ${nameOf(row.created_by, members)}` : '';
      return { id: row.id, label: `${shortDay(row.created_at)} · ${LOOK_LABELS[row.look]}${by}`, current: row.id === run.id };
    }),
  };
}

/** The Pitch tab: the shown pitch per audience, Customers first; null with no pitch. */
export function pitchView(read: PitchRead, picked: string | null, members: Member[]): PitchView | null {
  const shown = shownPitches(read.runs, picked);
  if (!shown.length) return null;
  return {
    audiences: shown.map((run) => audienceView(run, read.runs.filter((r) => r.audience === run.audience), read.links[run.id] ?? {}, members)),
  };
}

/** The Pitch tab's badge: how many pitches (`2 pitches`). */
export const pitchesBadge = (count: number) => `${count} pitch${count === 1 ? '' : 'es'}`;
