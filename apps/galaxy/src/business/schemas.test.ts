import { describe, expect, it } from 'vitest';
import type { z } from 'zod';

import { OpenedBusiness, Product, StoredCitation, StoredClaim, StoredReceipt } from './model';
import { StoredDraft } from './draft-port';
import { WebPage } from './reveal';
import { StoredPersona } from './personas';
import { FleetLookRow, IsOwner, RosterRow } from './constituents-rows';
import { ConfirmedClaim } from './recheck/recheck';
import { DraftRow } from './draft/run';
import { AddedSource, PastedPage, ProductId, TrackedRepository, WorkspaceRow } from './draft/store';

// Every schema the business module parses a Supabase row or a route's JSON with (PRD 1030): each
// parses a row as the module's tests already hold it, and refuses the same row with a column missing,
// a column of the wrong type, and a null where the column allows none.

type Case = {
  schema: z.ZodType;
  row: Record<string, unknown>;
  /** A column the row must have. */
  required: string;
  /** A column, and a value of the wrong type for it. */
  wrong: [string, unknown];
  /** A column that is never null, or null when every column of the row may be. */
  notNull: string | null;
};

const AVATAR = { v: 1, skin: 1, hair: 2, hairColor: 0, outfit: 1, accessory: 0 };
const DRAFT = { id: 'd-1', kind: 'draft', state: 'done', counts: { readmes: 1 }, scanned: [{ source: 'app · README.md', state: 'read' }], reason: null };

const CASES: Record<string, Case> = {
  StoredClaim: {
    schema: StoredClaim,
    row: { id: 'c-2', seq: 2, kind: 'rival', value: 'Acme Build', source: 'pick', state: 'confirmed', product_id: 'p-1' },
    required: 'seq', wrong: ['seq', '2'], notNull: 'value',
  },
  StoredReceipt: {
    schema: StoredReceipt,
    row: { claim_id: 'c-7', kind: 'file', location: 'acme/app/README.md', quote: 'Sold in France', seen_at: '2026-09-01T10:00:00Z' },
    required: 'quote', wrong: ['kind', 'email'], notNull: 'seen_at',
  },
  StoredCitation: {
    schema: StoredCitation,
    row: { claim_id: 'c-2', cited_by: 'think-big', ref: 'concept #9', cited_at: '2026-10-02T10:00:00Z' },
    required: 'cited_by', wrong: ['cited_at', 3], notNull: 'claim_id',
  },
  Product: { schema: Product, row: { id: 'p-1', name: 'Vertuoza' }, required: 'name', wrong: ['name', 7], notNull: 'id' },
  StoredDraft: { schema: StoredDraft, row: DRAFT, required: 'scanned', wrong: ['state', 'paused'], notNull: 'counts' },
  WebPage: { schema: WebPage, row: { id: 's-1', url: 'https://example.com/pricing' }, required: 'url', wrong: ['id', 1], notNull: 'url' },
  StoredPersona: {
    schema: StoredPersona,
    row: { id: 'pe-1', product_id: 'p-1', ordinal: 1, name: 'Irisa', stance: 'skeptical', trade: 'construction', avatar: AVATAR, who: 'A site manager', usage: '' },
    required: 'avatar', wrong: ['avatar', { ...AVATAR, skin: 9 }], notNull: 'name',
  },
  OpenedBusiness: { schema: OpenedBusiness, row: { id: 'b-1', workspace_id: 'ws-1', name: 'Vertuoza' }, required: 'id', wrong: ['id', 1], notNull: 'id' },
  RosterRow: {
    schema: RosterRow,
    row: { user_id: 'u-1', name: 'Ada', github_login: 'ada', avatar_url: null, fleet: null },
    required: 'github_login', wrong: ['name', 1], notNull: 'user_id',
  },
  FleetLookRow: { schema: FleetLookRow, row: { name: 'ion', label: 'ION', color: '#123456', mascot: null }, required: 'label', wrong: ['color', 1], notNull: 'name' },
  ConfirmedClaim: { schema: ConfirmedClaim, row: { workspace_id: 'ws-a' }, required: 'workspace_id', wrong: ['workspace_id', 1], notNull: 'workspace_id' },
  DraftRow: {
    schema: DraftRow,
    row: { ...DRAFT, state: 'running', started_at: '2026-09-30T10:00:00Z', finished_at: null },
    required: 'started_at', wrong: ['counts', { readmes: '1' }], notNull: 'scanned',
  },
  TrackedRepository: { schema: TrackedRepository, row: { full_name: 'acme/app', product_id: 'p-1' }, required: 'product_id', wrong: ['full_name', 1], notNull: 'full_name' },
  PastedPage: { schema: PastedPage, row: { url: 'https://acme.com' }, required: 'url', wrong: ['url', 1], notNull: 'url' },
  ProductId: { schema: ProductId, row: { id: 'p-1' }, required: 'id', wrong: ['id', 1], notNull: 'id' },
  AddedSource: {
    schema: AddedSource, row: { id: 's-1', url: 'https://acme.com', added_at: '2026-09-30T10:00:00Z' },
    required: 'added_at', wrong: ['url', 1], notNull: 'id',
  },
  WorkspaceRow: { schema: WorkspaceRow, row: { github_org: 'acme', github_installation_id: '42' }, required: 'github_org', wrong: ['github_installation_id', true], notNull: null },
};

const without = (row: Record<string, unknown>, key: string) => Object.fromEntries(Object.entries(row).filter(([k]) => k !== key));

describe('the business schemas', () => {
  for (const [name, { schema, row, required, wrong, notNull }] of Object.entries(CASES)) {
    describe(name, () => {
      it('parses the row the module reads', () => {
        expect(schema.safeParse(row).success).toBe(true);
      });
      it(`refuses it without ${required}`, () => {
        expect(schema.safeParse(without(row, required)).success).toBe(false);
      });
      it(`refuses ${wrong[0]} of the wrong type`, () => {
        expect(schema.safeParse({ ...row, [wrong[0]]: wrong[1] }).success).toBe(false);
      });
      if (notNull !== null) {
        it(`refuses a null ${notNull}`, () => {
          expect(schema.safeParse({ ...row, [notNull]: null }).success).toBe(false);
        });
      }
    });
  }

  it('reads a claim function\'s whole row as the columns a claim keeps', () => {
    const whole = { ...CASES.StoredClaim?.row, business_id: 'b-1', workspace_id: 'ws-1', created_at: '2026-10-01T10:00:00Z', created_by: null, updated_at: '2026-10-01T10:00:00Z', receipt: null };
    expect(StoredClaim.parse(whole)).not.toHaveProperty('business_id');
  });

  it('is_owner() answers a boolean, never a row', () => {
    expect(IsOwner.safeParse(true).success).toBe(true);
    expect(IsOwner.safeParse({ is_owner: true }).success).toBe(false);
    expect(IsOwner.safeParse(null).success).toBe(false);
  });

  it('keeps a claim\'s kind, state and source to what the columns allow', () => {
    const row = CASES.StoredClaim?.row ?? {};
    expect(StoredClaim.safeParse({ ...row, kind: 'never' }).success).toBe(true);
    expect(StoredClaim.safeParse({ ...row, kind: 'statement' }).success).toBe(false);
    expect(StoredClaim.safeParse({ ...row, state: 'maybe' }).success).toBe(false);
    expect(StoredClaim.safeParse({ ...row, source: 'guess' }).success).toBe(false);
  });
});
