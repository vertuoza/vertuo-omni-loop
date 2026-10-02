// The row and the migration agree: the columns the row schema reads are the table's own, and the
// schema refuses what the table's checks refuse. The access rules themselves are proved on the
// database by supabase/checks/releases.sql.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { INITIAL_RELEASE, parseReleaseRows, RELEASE_COLUMNS, RELEASES_TABLE, ReleaseRow, releaseVersion } from './row';
import { sure } from '../arcade/sure';

const MIGRATION = readFileSync(fileURLToPath(new URL('../../../../supabase/migrations/20260929090000_releases.sql', import.meta.url)), 'utf8');

const ROW = { prd: 262, release: 2, released_at: '2026-09-28T09:12:00+00:00', title: 'Release notes for everyone', description: 'A public page lists every release.' };

describe('a row of public.releases', () => {
  it('reads the columns the migration creates, in its order', () => {
    const table = /create table public\.releases \(([\s\S]*?)\n\);/.exec(MIGRATION);
    expect(table).not.toBeNull();
    const columns = sure(sure(table, 'table')[1], 'the table\'s columns').split('\n').map((line) => sure(line.trim().split(/\s+/)[0], 'a column\'s name')).filter((word) => /^[a-z_]+$/.test(word));
    expect(RELEASE_COLUMNS.split(',')).toEqual(columns);
    expect(RELEASES_TABLE).toBe('releases');
  });

  it('takes a row as PostgREST returns it', () => {
    expect(ReleaseRow.parse(ROW)).toEqual(ROW);
    expect(ReleaseRow.parse({ ...ROW, released_at: '2026-09-28T09:12:00.123456+02:00' }).released_at).toBe('2026-09-28T09:12:00.123456+02:00');
    expect(ReleaseRow.parse({ ...ROW, release: INITIAL_RELEASE, description: '' }).description).toBe('');
  });

  it('refuses what the table refuses: a release below 1, an empty title, a date without its offset', () => {
    expect(ReleaseRow.safeParse({ ...ROW, release: 0 }).success).toBe(false);
    expect(ReleaseRow.safeParse({ ...ROW, prd: 0 }).success).toBe(false);
    expect(ReleaseRow.safeParse({ ...ROW, title: '' }).success).toBe(false);
    expect(ReleaseRow.safeParse({ ...ROW, released_at: '28 Sep 2026' }).success).toBe(false);
    expect(ReleaseRow.safeParse({ ...ROW, extra: 1 }).success).toBe(false);
  });

  it('reads a page of rows, and says which row it could not read', () => {
    expect(parseReleaseRows([ROW])).toEqual([ROW]);
    expect(() => parseReleaseRows([ROW, { ...ROW, prd: 'x' }])).toThrow(/row 2/);
  });

  it('is shown as its patch version, the full 0.0.<release>', () => {
    expect(releaseVersion(INITIAL_RELEASE)).toBe('0.0.1');
    expect(releaseVersion(12)).toBe('0.0.12');
  });
});
