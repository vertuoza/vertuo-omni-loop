// A mission's folder (PRD 2842, s2), as `omni mission push <n>` sends it: the folder of mission <n>
// under the layout's missions folder, `<nnnn>-<slug>/`, gives its `mission.md` as its record and its
// `mission.html` as its brief, whole, in that order. Its title is mission.md's front-matter `title`.
// The folder is refused, every fault named and nothing sent, when either file is missing, mission.md
// does not read or names another mission, or mission.html breaks the page rules.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { MISSION_PAGE, MISSION_RECORD, parseBrief } from './brief.ts';
import { pageFaults } from './page.ts';
import type { Brief } from './brief.ts';
import type { IssueNumber } from '../ids.ts';
import type { Layout } from '../layout.ts';

/** The kinds a mission's page takes, in the order a push sends them. */
export type MissionArtifactKind = 'mission-record' | 'brief';

/** A mission's folder, read whole. */
export type MissionFolder = {
  mission: IssueNumber;
  dir: string;
  brief: Brief;
  artifacts: Array<{ kind: MissionArtifactKind; path: string; content: string }>;
};

export type MissionRead = { ok: true; folder: MissionFolder } | { ok: false; dir: string; errors: string[] };

/** The folder of mission `mission` under `root`, `<nnnn>-<slug>`, or null when there is none. */
function folderOf(checkout: string, root: string, mission: IssueNumber): string | null {
  if (!existsSync(join(checkout, root))) return null;
  const named = new RegExp(`^0*${String(mission)}-.`);
  const [first] = readdirSync(join(checkout, root), { withFileTypes: true }).flatMap((entry) => (entry.isDirectory() && named.test(entry.name) ? [entry.name] : [])).sort();
  return first === undefined ? null : `${root}/${first}`;
}

/** Mission `mission`'s folder read, or every fault that refuses it; null when it has no folder. */
export function readMissionFolder(ctx: { root: string; layout: Layout }, mission: IssueNumber): MissionRead | null {
  const dir = folderOf(ctx.root, ctx.layout.dirs.missions, mission);
  return dir ? readFolderAt(join(ctx.root, dir), dir, mission) : null;
}

/** The folder `abs` (a mission's folder anywhere: `omni mission push --from`) read, or every fault that refuses it, naming it `label`; null when it is no folder. */
export function readMissionFolderAt(abs: string, label: string, mission: IssueNumber): MissionRead | null {
  return existsSync(abs) && statSync(abs).isDirectory() ? readFolderAt(abs, label, mission) : null;
}

/** What mission.md's parse says against the mission asked for, one line each. */
function recordFaults(dir: string, parsed: ReturnType<typeof parseBrief>, mission: IssueNumber): string[] {
  const file = `${dir}/${MISSION_RECORD}`;
  if (!parsed.ok) return parsed.errors.map((error) => `${file}: ${error}`);
  return parsed.brief.mission === mission ? [] : [`${file}: mission is #${parsed.brief.mission}, not #${mission}.`];
}

/** The text of `abs/name`, or null when there is no such file. */
function readText(abs: string, name: string): string | null {
  const path = join(abs, name);
  return existsSync(path) ? readFileSync(path, 'utf8') : null;
}

/** Every fault of the folder's two files, one line each. */
function faultsOf(dir: string, files: { record: string | null; page: string | null }, parsed: ReturnType<typeof parseBrief> | null, mission: IssueNumber): string[] {
  const missing = Object.entries({ [MISSION_RECORD]: files.record, [MISSION_PAGE]: files.page }).flatMap(([name, content]) => (content === null ? [`${dir} has no ${name}.`] : []));
  return [
    ...missing,
    ...(parsed ? recordFaults(dir, parsed, mission) : []),
    ...(files.page === null ? [] : pageFaults(`${dir}/${MISSION_PAGE}`, files.page)),
  ];
}

function readFolderAt(abs: string, dir: string, mission: IssueNumber): MissionRead {
  const record = readText(abs, MISSION_RECORD);
  const page = readText(abs, MISSION_PAGE);
  const parsed = record === null ? null : parseBrief(record);
  const errors = faultsOf(dir, { record, page }, parsed, mission);
  if (errors.length || !parsed?.ok || record === null || page === null) return { ok: false, dir, errors };
  return {
    ok: true,
    folder: {
      mission, dir, brief: parsed.brief,
      artifacts: [
        { kind: 'mission-record', path: `${dir}/${MISSION_RECORD}`, content: record },
        { kind: 'brief', path: `${dir}/${MISSION_PAGE}`, content: page },
      ],
    },
  };
}
