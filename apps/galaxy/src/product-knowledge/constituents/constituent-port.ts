import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '../../../../../supabase/database.types.ts';
import { databaseConstituents, demoConstituentsPort, type ConstituentPort } from '../../constituents/store';
import type { WriteSource } from './knowledge-reader';

// The Constituents section's writes in the browser (PRD 2240 s4): the functions of
// supabase/migrations/20261029090000_constituents.sql, called as the signed-in person, as Settings ›
// Business called them (../../constituents/store.ts); in the demo, the same rules kept in memory.

export const constituentPortFor = (source: WriteSource, product: string, me: string | null): ConstituentPort =>
  source.kind === 'demo'
    ? demoConstituentsPort({ products: [product], by: me ?? 'demo' })
    : databaseConstituents(createBrowserClient<Database>(source.url, source.key), source.workspace);
