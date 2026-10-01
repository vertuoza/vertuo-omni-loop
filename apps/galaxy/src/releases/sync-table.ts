// The sync's one way into public.releases (supabase/migrations/20260929090000_releases.sql), as the
// service role. It does only what the migration grants that role: read every row, add rows, and
// refresh a row's title and description. It never renumbers, redates or deletes a row. A refusal
// throws with Supabase's reason.
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../../../supabase/database.types.ts';
import { parseReleaseRows, RELEASE_COLUMNS, RELEASES_TABLE, type ReleaseRow } from './row.ts';
import type { ReleaseText } from './sync.ts';

/** The project's max_rows (supabase/config.toml): the most rows one read returns. */
const PAGE = 1000;

type Refusal = { message: string; code?: string } | null;

export type ReleasesTable = {
  /** Every row, by PRD number. */
  rows(): Promise<ReleaseRow[]>;
  /** Adds new rows, all in one insert: every one is written, or none. */
  insert(rows: ReleaseRow[]): Promise<void>;
  /** Sets a row's title and description, found by its PRD. */
  refresh(text: ReleaseText): Promise<void>;
};

function settle(what: string, error: Refusal): void {
  if (error) throw new Error(`Supabase refused to ${what}: ${error.message}${error.code ? ` (${error.code})` : ''}`);
}

export function releasesTable(db: Pick<SupabaseClient<Database>, 'from'>): ReleasesTable {
  return {
    async rows() {
      const rows: ReleaseRow[] = [];
      for (let first = 0; ; first += PAGE) {
        const { data, error } = await db.from(RELEASES_TABLE).select(RELEASE_COLUMNS).order('prd').range(first, first + PAGE - 1);
        settle('read the releases', error);
        const page = (data ?? []) as unknown[];
        rows.push(...parseReleaseRows(page));
        if (page.length < PAGE) return rows;
      }
    },

    async insert(rows) {
      if (rows.length === 0) return;
      const { error } = await db.from(RELEASES_TABLE).insert(rows);
      settle(`add ${rows.length} ${rows.length === 1 ? 'release' : 'releases'}`, error);
    },

    async refresh({ prd, title, description }) {
      const { error } = await db.from(RELEASES_TABLE).update({ title, description }).eq('prd', prd);
      settle(`refresh the text of PRD ${prd}`, error);
    },
  };
}
