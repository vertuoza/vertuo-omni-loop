// The demo sample of /releases (PRD 262): what the page shows in development, or in a build that asks
// for the demo. Its initial release is this repository's own, word for word from the shipped notes;
// the releases after it are a sample, written by the rules every note follows, spread over enough
// weeks that the oldest one folds.
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { gradeReleaseNote, parseReleaseNote } from 'vertuo-omni-plan/kit/lib/releases/note.mjs';
import { DEMO_RELEASES } from './demo';
import { INITIAL_RELEASE, ReleaseRow } from './row';
import { OPEN_WEEKS, weeksOf } from './weeks';

const SHIPPED = fileURLToPath(new URL('../../../../.omni-loop/delivery/shipped/', import.meta.url));

/** Every note pinned to the initial release in the shipped folders, by PRD. */
function pinnedNotes() {
  return readdirSync(SHIPPED)
    .map((folder) => join(SHIPPED, folder, 'release.md'))
    .filter((file) => existsSync(file))
    .map((file) => parseReleaseNote(readFileSync(file, 'utf8')).note)
    .flatMap((note) => (note?.version === '0.0.1' ? [{ prd: note.prd, title: note.title, description: note.description }] : []))
    .sort((a, b) => a.prd - b.prd);
}

describe('the demo sample', () => {
  it('holds rows as public.releases returns them', () => {
    expect(DEMO_RELEASES.length).toBeGreaterThan(0);
    for (const row of DEMO_RELEASES) expect(ReleaseRow.parse(row), `PRD ${row.prd}`).toEqual(row);
  });

  it('numbers as the table does: one PRD per release above 1, and every PRD once', () => {
    const above = DEMO_RELEASES.filter((r) => r.release > INITIAL_RELEASE).map((r) => r.release);
    expect(new Set(above).size).toBe(above.length);
    const prds = DEMO_RELEASES.map((r) => r.prd);
    expect(new Set(prds).size).toBe(prds.length);
  });

  it('opens with the initial release this repository shipped, every note word for word', () => {
    const initial = DEMO_RELEASES.filter((r) => r.release === INITIAL_RELEASE)
      .map(({ prd, title, description }) => ({ prd, title, description }))
      .sort((a, b) => a.prd - b.prd);
    const notes = pinnedNotes();
    expect(notes).toHaveLength(21);
    expect(initial).toEqual(notes);
  });

  it('writes every sample release by the rules a release note follows', () => {
    for (const { prd, title, description } of DEMO_RELEASES.filter((r) => r.release > INITIAL_RELEASE)) {
      expect(gradeReleaseNote(`---\nprd: ${prd}\ntitle: ${title}\n---\n${description}\n`, { prd }), `PRD ${prd}`).toEqual([]);
    }
  });

  it('spans more weeks than the page keeps open, so the oldest one folds', () => {
    const weeks = weeksOf(DEMO_RELEASES);
    expect(weeks.length).toBeGreaterThan(OPEN_WEEKS);
    expect(weeks.at(-1)?.open).toBe(false);
    expect(weeks.at(-1)?.releases.map((r) => r.release)).toEqual([INITIAL_RELEASE]);
  });
});
