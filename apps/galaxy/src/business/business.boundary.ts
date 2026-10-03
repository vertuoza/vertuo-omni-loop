// The business module's reads from Supabase, for `pnpm schemas:verify` (PRD 1030,
// scripts/schemas-verify.ts): each is the module's own select, with its columns and its schema, over
// every workspace (no filter). The functions that write and answer a row (claim_pick(),
// claim_set_state(), product_add(), the persona functions, business_draft_start(),
// business_source_add()) cannot run here, as the script only reads: the whole row each answers is
// read with `select('*')` instead and parsed with the same schema. business_open() (it makes the
// business the first time), workspace_roster() (members only, never the service role) and
// claim_propose_evidence() (it writes, and answers an outcome no table holds) are not registered.
import type { Boundary } from '../data/parse-rows';
import { CITATION_COLUMNS, CLAIM_COLUMNS, Product, PRODUCT_COLUMNS, RECEIPT_COLUMNS, StoredCitation, StoredClaim, StoredReceipt } from './model';
import { DRAFT_COLUMNS, StoredDraft } from './draft-port';
import { PAGE_COLUMNS, WebPage } from './reveal';
import { PERSONA_COLUMNS, StoredPersona } from './personas';
import { FLEET_COLUMNS, FleetLookRow, IsOwner } from './constituents-rows';
import { SUGGEST_CLAIM_COLUMNS } from './suggest-store';
import { ConfirmedClaim } from './recheck/recheck';
import { DraftRow } from './draft/run';
import {
  AddedSource, DRAFT_CLAIM_COLUMNS, DRAFT_COLUMNS as RUN_DRAFT_COLUMNS, PastedPage, ProductId, REPOSITORY_COLUMNS,
  TrackedRepository, WORKSPACE_COLUMNS, WorkspaceRow,
} from './draft/store';

/** No workspace: is_owner() answers false for it, which is all its answer's shape needs. */
const NO_WORKSPACE = '00000000-0000-0000-0000-000000000000';

export const boundaries: Boundary[] = [
  // The page's read (./load.ts).
  { name: 'business/load: products', read: (db) => db.from('products').select(PRODUCT_COLUMNS), schema: Product, shape: 'rows' },
  { name: 'business/load: claims', read: (db) => db.from('claims').select(CLAIM_COLUMNS), schema: StoredClaim, shape: 'rows' },
  { name: 'business/load: claim_citations', read: (db) => db.from('claim_citations').select(CITATION_COLUMNS), schema: StoredCitation, shape: 'rows' },
  { name: 'business/load: claim_receipts', read: (db) => db.from('claim_receipts').select(RECEIPT_COLUMNS), schema: StoredReceipt, shape: 'rows' },
  { name: 'business/load: business_sources', read: (db) => db.from('business_sources').select(PAGE_COLUMNS), schema: WebPage, shape: 'rows' },
  { name: 'business/load: business_drafts', read: (db) => db.from('business_drafts').select(DRAFT_COLUMNS), schema: StoredDraft, shape: 'rows' },
  { name: 'business/load: personas', read: (db) => db.from('personas').select(PERSONA_COLUMNS), schema: StoredPersona, shape: 'rows' },
  // The rows the write functions answer, whole.
  { name: 'business/store: claim_pick, claim_set_state (a public.claims row)', read: (db) => db.from('claims').select('*'), schema: StoredClaim, shape: 'rows' },
  { name: 'business/store: product_add (a public.products row)', read: (db) => db.from('products').select('*'), schema: Product, shape: 'rows' },
  { name: 'business/personas-store: the persona functions (a public.personas row)', read: (db) => db.from('personas').select('*'), schema: StoredPersona, shape: 'rows' },
  { name: 'business/draft/store: business_draft_start (a public.business_drafts row)', read: (db) => db.from('business_drafts').select('*'), schema: DraftRow, shape: 'rows' },
  { name: 'business/draft/store: business_source_add (a public.business_sources row)', read: (db) => db.from('business_sources').select('*'), schema: AddedSource, shape: 'rows' },
  { name: 'business/draft-port: the draft route (a public.business_drafts row)', read: (db) => db.from('business_drafts').select('*'), schema: StoredDraft, shape: 'rows' },
  // The draft's run (./draft/store.ts, ./draft/live.ts).
  { name: 'business/draft/store: business_drafts', read: (db) => db.from('business_drafts').select(RUN_DRAFT_COLUMNS), schema: DraftRow, shape: 'rows' },
  { name: 'business/draft/store: repositories', read: (db) => db.from('repositories').select(REPOSITORY_COLUMNS), schema: TrackedRepository, shape: 'rows' },
  { name: 'business/draft/store: business_sources', read: (db) => db.from('business_sources').select('url'), schema: PastedPage, shape: 'rows' },
  { name: 'business/draft/store: products', read: (db) => db.from('products').select('id'), schema: ProductId, shape: 'rows' },
  { name: 'business/draft/store: claims', read: (db) => db.from('claims').select(DRAFT_CLAIM_COLUMNS), schema: StoredClaim, shape: 'rows' },
  { name: 'business/draft/live: workspaces', read: (db) => db.from('workspaces').select(WORKSPACE_COLUMNS), schema: WorkspaceRow, shape: 'rows' },
  // The rival suggestions (./suggest-store.ts) and the weekly recheck (./recheck/recheck.ts).
  { name: 'business/suggest-store: claims', read: (db) => db.from('claims').select(SUGGEST_CLAIM_COLUMNS), schema: StoredClaim, shape: 'rows' },
  { name: 'business/recheck: claims', read: (db) => db.from('claims').select('workspace_id').eq('state', 'confirmed'), schema: ConfirmedClaim, shape: 'rows' },
  // The constituents panel's own reads (./constituents-load.ts).
  { name: 'business/constituents-load: is_owner', read: (db) => db.rpc('is_owner', { workspace: NO_WORKSPACE }, { get: true }), schema: IsOwner, shape: 'row' },
  { name: 'business/constituents-load: teams', read: (db) => db.from('teams').select(FLEET_COLUMNS), schema: FleetLookRow, shape: 'rows' },
];
