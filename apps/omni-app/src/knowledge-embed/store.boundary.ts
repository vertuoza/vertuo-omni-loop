// The knowledge embed store's reads (./store.ts), for `pnpm schemas:verify` (PRD 1030): each table it reads, with
// the columns it selects, parsed with the schema the store parses it with. Its two functions write or take a
// workspace's hashes, and are not run here.
import type { Boundary } from '../boundary.ts';
import { FileRowSchema, HolderRowSchema, LegalRowSchema, NeverRowSchema, PackRowSchema, ProductRowSchema, TermRowSchema } from './store.ts';

export const boundaries: Boundary[] = [
  { name: 'knowledge-embed/store: knowledge_packs', read: (db) => db.from('knowledge_packs').select('id, workspace_id').limit(5), schema: PackRowSchema, shape: 'rows' },
  { name: 'knowledge-embed/store: knowledge_pack_files', read: (db) => db.from('knowledge_pack_files').select('path, content').limit(5), schema: FileRowSchema, shape: 'rows' },
  { name: 'knowledge-embed/store: product_repositories', read: (db) => db.from('product_repositories').select('product_id, workspace_id, repository').limit(5), schema: HolderRowSchema, shape: 'rows' },
  { name: 'knowledge-embed/store: products', read: (db) => db.from('products').select('id, workspace_id, plan_repository').limit(5), schema: ProductRowSchema, shape: 'rows' },
  { name: 'knowledge-embed/store: product_legal', read: (db) => db.from('product_legal').select('product_id, code, number, statement, source').limit(5), schema: LegalRowSchema, shape: 'rows' },
  { name: 'knowledge-embed/store: product_glossary', read: (db) => db.from('product_glossary').select('product_id, term, meaning, avoid').limit(5), schema: TermRowSchema, shape: 'rows' },
  { name: 'knowledge-embed/store: constituents', read: (db) => db.from('constituents').select('product_id, seq, body').eq('kind', 'never').limit(5), schema: NeverRowSchema, shape: 'rows' },
];
