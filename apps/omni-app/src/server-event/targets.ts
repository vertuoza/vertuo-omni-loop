// The open target pull requests of a product PRD (PRD 1548 s4), read from the database as the service
// role (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, the approved check's own pair), never from GitHub:
//
//   dossiers               the server event's dossier: a PRD with a product and its number there
//   products               the product's key, for the PRD's id (`mobile-12`)
//   workspaces             the workspace's GitHub installation, which every call to its repositories spends
//   product_repositories   the repositories the product holds
//   pull_requests          their pull requests the collector last read open (PRD 612): neither merged nor closed
//
// A dossier that is no product PRD, or a workspace with no installation, reads as null: there is nothing
// to re-check. Which of those pull requests are the PRD's own (`Part of mobile-12`) is read from each
// one's body by ./recheck.ts. Throws when the database refuses or answers out of shape.
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import type { Database } from '../../../../supabase/database.types.ts';
import type { Connection } from '../approved-check/record.ts';

/** One open pull request of a repository the product holds. */
export type OpenPull = { repository: string; number: number };

/** A product PRD's targets: its id, the installation its repositories are reached through, and their open pull requests. */
export type PrdTargets = { prdId: string; installationId: number; pulls: OpenPull[] };

/** Reads the targets of the product PRD dossier `dossier` is; null when it is none, or there is no installation. */
export type TargetsReader = (dossier: string) => Promise<PrdTargets | null>;

const text = z.string().min(1);
const DossierRowSchema = z.object({ workspace_id: text, product_id: text.nullable(), product_seq: z.number().int().positive().nullable() });
const ProductRowSchema = z.object({ key: text.nullable() });
const WorkspaceRowSchema = z.object({ github_installation_id: z.number().int().positive().nullable() });
const LinkRowSchema = z.object({ repository: text });
const PullRowSchema = z.object({ repo: text, number: z.number().int().positive() });

type Answer = { data: unknown; error: { message: string; code?: string } | null };

/** An answer's rows through `schema`, or the refusal thrown. */
function rowsOf<T>(schema: z.ZodType<T>, answer: Answer): T[] {
  if (answer.error) throw new Error(`the database refused: ${answer.error.message}${answer.error.code ? ` (${answer.error.code})` : ''}`);
  return z.array(schema).parse(answer.data ?? []);
}

/** The targets reader, as the service role on `connection`. */
export function targetsReader({ url, key, fetch }: Connection): TargetsReader {
  const db = createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    ...(fetch ? { global: { fetch } } : {}),
  });
  return async (dossier) => {
    const [row] = rowsOf(DossierRowSchema, await db.from('dossiers').select('workspace_id, product_id, product_seq').eq('id', dossier).eq('kind', 'prd').limit(1));
    if (!row?.product_id || row.product_seq === null) return null;
    const [product] = rowsOf(ProductRowSchema, await db.from('products').select('key').eq('id', row.product_id).limit(1));
    if (!product?.key) return null;
    const [workspace] = rowsOf(WorkspaceRowSchema, await db.from('workspaces').select('github_installation_id').eq('id', row.workspace_id).limit(1));
    if (!workspace?.github_installation_id) return null;
    const repositories = rowsOf(LinkRowSchema, await db.from('product_repositories').select('repository').eq('product_id', row.product_id)).map((link) => link.repository);
    const pulls = repositories.length === 0 ? [] : rowsOf(PullRowSchema, await db.from('pull_requests').select('repo, number')
      .eq('workspace_id', row.workspace_id).in('repo', repositories).is('merged_at', null).is('closed_at', null)
      .order('repo', { ascending: true }).order('number', { ascending: true }));
    return {
      prdId: `${product.key}-${row.product_seq}`,
      installationId: workspace.github_installation_id,
      pulls: pulls.map((pull) => ({ repository: pull.repo, number: pull.number })),
    };
  };
}
