import { describe, expect, it, vi } from 'vitest';
import type { z } from 'zod';
import { assertDefined } from 'vertuo-omni-plan/kit/test/assert.ts';

vi.mock('server-only', () => ({}));

import { brokenRows, type Breaks } from './broken-rows.fake';
import { DossierListEntry } from './dossiers';
import { fakeGalaxyDb, PEOPLE, twoWorkspaces, VERTUOZA } from './galaxy.fake';
import { LEDGER_COLUMNS, LedgerRow } from './load-galaxy';
import { PLAYER_COLUMNS, StoredPlayer } from './players';
import { sessionOf } from './sign-in';
import { SCORE_COLUMNS, ScoreRow } from './scores';
import { MEMBERSHIP_COLUMNS, MembershipRow } from './workspace';

// The arcade's data schemas (PRD 1030): each parses the rows the module's own fixture gives through its
// select (the galaxy fake, src/data/galaxy.fake.ts), and refuses a copy of one with a column missing, a
// column of the wrong type and a null where the column allows none.

/** The first row of a select as the fake answers it to ADA, a member of Vertuoza. */
async function firstRow(table: Parameters<ReturnType<ReturnType<typeof fakeGalaxyDb>['client']>['from']>[0], columns: string): Promise<Record<string, unknown>> {
  const { data } = await fakeGalaxyDb(twoWorkspaces()).client(PEOPLE.ada).from(table).select(columns).eq('workspace_id', VERTUOZA);
  const rows: unknown = data;
  const row: unknown = Array.isArray(rows) ? rows[0] : undefined;
  if (typeof row !== 'object' || row === null) throw new Error(`the fake answered no ${table} row`);
  return Object.fromEntries(Object.entries(row));
}

function refuses(schema: z.ZodType, row: Record<string, unknown>, breaks: Breaks): void {
  for (const [how, broken] of brokenRows(row, breaks)) {
    expect(schema.safeParse(broken).success, how).toBe(false);
  }
}

describe('the arcade\'s data schemas', () => {
  it('parse a player as PLAYER_COLUMNS reads it, and refuse a broken one', async () => {
    const row = await firstRow('players', PLAYER_COLUMNS);
    expect(StoredPlayer.parse(row)).toMatchObject({ id: PEOPLE.ada.id, display_name: 'ADA' });
    refuses(StoredPlayer, row, { missing: 'hero', wrongType: ['display_name', 7], notNull: 'id' });
    expect(StoredPlayer.safeParse({ ...row, hero: { v: 2, body: 'girl', skin: 0, hair: 0, suit: 0, cape: 0 } }).success).toBe(false);
  });

  it('parse a ledger row as LEDGER_COLUMNS reads it, and refuse a broken one', async () => {
    const row = await firstRow('ledger_events', LEDGER_COLUMNS);
    expect(LedgerRow.parse(row)).toMatchObject({ type: 'PLANET_CHARTED' });
    refuses(LedgerRow, row, { missing: 'planet', wrongType: ['planet', '12'], notNull: 'at' });
  });

  it('parse a line of a game\'s table as SCORE_COLUMNS reads it, its best a number even when sent as text', async () => {
    const row = await firstRow('arcade_scores', SCORE_COLUMNS);
    expect(ScoreRow.parse(row)).toMatchObject({ best: 1240, player: { display_name: 'ADA' } });
    expect(ScoreRow.parse({ ...row, best: '1240' }).best).toBe(1240);
    refuses(ScoreRow, row, { missing: 'player', wrongType: ['id', 7], notNull: 'id' });
  });

  it('parse a membership as MEMBERSHIP_COLUMNS reads it, and refuse a broken one', async () => {
    const { data } = await fakeGalaxyDb(twoWorkspaces()).client(PEOPLE.ada).from('workspace_members').select(MEMBERSHIP_COLUMNS).eq('user_id', PEOPLE.ada.id);
    const rows = MembershipRow.array().parse(data);
    expect(rows).toEqual([{ joined_at: '2026-09-26T08:00:00Z', workspace: { id: VERTUOZA, slug: 'vertuoza', name: 'Vertuoza', theme: {} } }]);
    const row = { ...assertRow(rows[0]) };
    refuses(MembershipRow, row, { missing: 'workspace', wrongType: ['joined_at', 1], notNull: 'joined_at' });
  });

  it('parse a dossier as dossier_list() lists it, its counts numbers even when sent as text, and refuse a broken one', () => {
    const row = {
      id: 'd-12', workspace_id: VERTUOZA, home_repo: 'vertuoza/vertuo-omni-plan', prd: 12, kind: 'prd', title: 'PRD 12', opened_by: PEOPLE.ada.id,
      created_at: '2026-09-20T09:00:00Z', numbered_at: '2026-09-20T10:00:00Z', repos: ['vertuoza/vertuo-omni-plan'],
      latest: { spec: { id: 'v-spec-3', version: 3, source: 'kit', created_at: '2026-09-25T08:00:00Z' } }, asked: 12, answered: 11,
      last_activity: '2026-09-25T08:00:00Z',
    };
    expect(DossierListEntry.parse(row)).toEqual(row);
    expect(DossierListEntry.parse({ ...row, asked: '12' }).asked).toBe(12);
    refuses(DossierListEntry, row, { missing: 'latest', wrongType: ['repos', 'vertuoza/vertuo-omni-plan'], notNull: 'title' });
    expect(DossierListEntry.safeParse({ ...row, latest: { roadmap: row.latest.spec } }).success).toBe(false);
  });
});

function assertRow<T>(row: T | undefined): T {
  assertDefined(row, 'a row');
  return row;
}

describe('the session a sign-in hands back', () => {
  const session = { access_token: 'jwt', provider_token: 'gho_x', user: { id: PEOPLE.ada.id, email: 'ada@vertuoza.com' } };

  it('is its user\'s id and GitHub\'s token, its other fields left as they came', () => {
    expect(sessionOf({ session, user: session.user }, 'test')).toEqual({ provider_token: 'gho_x', user: { id: PEOPLE.ada.id } });
    expect(sessionOf({ session: { ...session, provider_token: null } }, 'test')).toMatchObject({ provider_token: null });
  });

  it('is none when the answer carried none, or one that does not parse', () => {
    expect(sessionOf(null, 'test')).toBeNull();
    expect(sessionOf({ session: null }, 'test')).toBeNull();
    for (const [how, broken] of brokenRows(session, { missing: 'user', wrongType: ['provider_token', 7], notNull: 'user' })) {
      expect(sessionOf({ session: broken }, 'test'), how).toBeNull();
    }
  });
});
