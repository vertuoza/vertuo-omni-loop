// A mission's folder (PRD 2842, s2), as `omni mission push <n>` sends it: the folder of mission <n>
// under the layout's missions folder, `<nnnn>-<slug>/`, gives its `mission.md` as its record and its
// `mission.html` as its brief, whole, in that order. Its title is mission.md's front-matter `title`.
// The folder is refused, every fault named and nothing sent, when either file is missing, mission.md
// does not read or names another mission, or mission.html breaks the page rules.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
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
  const absolute = join(checkout, root);
  if (!existsSync(absolute)) return null;
  const prefix = `${String(mission).padStart(4, '0')}-`;
  const name = readdirSync(absolute, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name.startsWith(prefix) && entry.name.length > prefix.length)
    .map((entry) => entry.name)
    .sort()[0];
  return name ? `${root}/${name}` : null;
}

/** Mission `mission`'s folder read, or every fault that refuses it; null when it has no folder. */
export function readMissionFolder(ctx: { root: string; layout: Layout }, mission: IssueNumber): MissionRead | null {
  const dir = folderOf(ctx.root, ctx.layout.dirs.missions, mission);
  if (!dir) return null;
  const read = (name: string): string | null => {
    const path = join(ctx.root, dir, name);
    return existsSync(path) ? readFileSync(path, 'utf8') : null;
  };
  const record = read(MISSION_RECORD);
  const page = read(MISSION_PAGE);
  const errors = [MISSION_RECORD, MISSION_PAGE].filter((name, index) => [record, page][index] === null).map((name) => `${dir} has no ${name}.`);
  const parsed = record === null ? null : parseBrief(record);
  if (parsed && !parsed.ok) errors.push(...parsed.errors.map((error) => `${dir}/${MISSION_RECORD}: ${error}`));
  if (parsed?.ok && parsed.brief.mission !== mission) {
    errors.push(`${dir}/${MISSION_RECORD}: mission is #${parsed.brief.mission}, not #${mission}.`);
  }
  if (page !== null) errors.push(...pageFaults(`${dir}/${MISSION_PAGE}`, page));
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
