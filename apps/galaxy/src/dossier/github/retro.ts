// Where the PRD page reads a PRD's retro (PRD 426, s3): `retro.md` in the PRD's shipped folder, from
// the retro branch while its pull request is open, and from the default branch once it is merged. No
// retro PR, no read. The branch shapes and the delivery path come from the repository's own config,
// through ./reader.ts, which reads the file; a failed read throws, so the summary marks it unread.
import type { PullRef } from './summary';

export const RETRO_FILE = 'retro.md';

/** What the retro's place depends on: the delivery path, the PRD's folder, the default branch and the retro branch. */
export type RetroWhere = { delivery: string; folder: string | null; defaultBranch: string; retroBranch: string };

/** The file and the ref retro.md is read at; null when there is no retro PR or no folder. */
export function retroSource(retro: PullRef | null, where: RetroWhere): { file: string; ref: string } | null {
  if (!retro || !where.folder) return null;
  return {
    file: `${where.delivery}/shipped/${where.folder}/${RETRO_FILE}`,
    ref: retro.state === 'open' ? where.retroBranch : where.defaultBranch,
  };
}

/** retro.md as its source holds it; null when there is no retro PR, or the file is not there yet. */
export async function readRetro(
  retro: PullRef | null, where: RetroWhere, raw: (file: string, ref: string) => Promise<string | null>,
): Promise<string | null> {
  const source = retroSource(retro, where);
  return source ? raw(source.file, source.ref) : null;
}
