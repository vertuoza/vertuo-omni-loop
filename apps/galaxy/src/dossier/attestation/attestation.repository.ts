import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { parsePrd, type PrdNumber } from 'vertuo-omni-plan/kit/lib/ids.ts';
import { orThrow, parseRows } from '../../data/parse-rows';
import { readApproval, readAskedApprovers, readVoids, type ApprovalRow } from '../page/approval';
import type { AttestationFacts } from './attestation-facts';

// The Attestation page's storage (PRD 1612 s4; ADR-0095): what the signed-in member reads of a ◆ PRD's
// approval record, on their own client, so row-level security decides, as on the PRD's page. The approval
// in force, its voids and the members its product asks to approve are read by the PRD page's own approval
// code (../page/approval.ts); beside them, who approved by account id, the approved text of each pinned
// version (for `whitespace only`), the workspace's members (ask_members()) and name, and the PRD's product
// with its repositories (where its target PRs live). A dossier the member does not read, a draft, a fix or
// a concept is not found; a PRD approved in its repository (◇) says so. A failed read throws, and an
// answer out of shape too, except the product's approvers, which read `unread` as on the PRD's page. No
// rule lives here: ./attestation.service.ts judges.

export type AttestationDb = Pick<SupabaseClient, 'from' | 'rpc'>;

const DossierRow = z.object({
  id: z.string(), workspace_id: z.string(), home_repo: z.string(), prd: z.number().int().positive().nullable(),
  kind: z.string().nullable().optional(), birthplace: z.string().nullable().optional(), product_id: z.string().nullable().optional(),
});
type Dossier = z.infer<typeof DossierRow>;
const ApprovedBy = z.object({ approved_by: z.string() });
const Content = z.object({ id: z.string(), content: z.string() });
const MemberRow = z.object({ user_id: z.string() });
const NameRow = z.object({ name: z.string() });
const RepoRow = z.object({ repository: z.string() });

type Answer = { data: unknown; error: { message: string } | null };

/** The rows of `answer`, parsed with `schema`; throws, naming `what`, on an error or rows out of shape. */
function rowsOf<T>(schema: z.ZodType<T>, answer: Answer, what: string): T[] {
  if (answer.error) throw new Error(`Supabase: could not read ${what} (${answer.error.message})`);
  return orThrow(parseRows(schema, answer.data, `dossier/attestation: ${what}`));
}

export function attestationRepository(db: AttestationDb) {
  const read = async <T>(query: PromiseLike<Answer>, schema: z.ZodType<T>, what: string): Promise<T[]> => rowsOf(schema, await query, what);

  /** The PRD's product: its name and repositories; null when it has none, or the member reads none. */
  async function productOf(id: string | null | undefined): Promise<AttestationFacts['product']> {
    if (!id) return null;
    const [named, repos] = await Promise.all([
      read(db.from('products').select('name').eq('id', id).limit(1), NameRow, 'the product'),
      read(db.from('product_repositories').select('repository').eq('product_id', id), RepoRow, 'the product\'s repositories'),
    ]);
    const [product] = named;
    return product ? { name: product.name, repos: repos.map((r) => r.repository) } : null;
  }

  /** Who approved, by account id, and the approved text of each version the approval pins. */
  async function approvedOf(approval: ApprovalRow | null): Promise<Pick<AttestationFacts, 'approvedBy' | 'contents'>> {
    if (approval === null) return { approvedBy: null, contents: new Map() };
    const versions = [...new Set(approval.files.map((f) => f.version_id))];
    const [by, contents] = await Promise.all([
      read(db.from('approvals').select('approved_by').eq('id', approval.id).limit(1), ApprovedBy, 'the approver'),
      read(db.from('dossier_versions').select('id, content').in('id', versions), Content, 'the approved versions'),
    ]);
    return { approvedBy: by[0]?.approved_by ?? null, contents: new Map(contents.map((c) => [c.id, c.content])) };
  }

  /** What the member reads of a ◆ PRD's record, beside its dossier. */
  async function factsOf(dossier: Dossier, prd: PrdNumber): Promise<AttestationFacts> {
    const asked = readAskedApprovers(db, dossier).catch((error: unknown) => {
      console.error(error);
      return 'unread' as const;
    });
    const [approval, voids, members, workspaces, product] = await Promise.all([
      readApproval(db, dossier.id),
      readVoids(db, dossier.id),
      read(db.rpc('ask_members', { workspace: dossier.workspace_id }), MemberRow, 'the members'),
      read(db.from('workspaces').select('name').eq('id', dossier.workspace_id).limit(1), NameRow, 'the workspace'),
      productOf(dossier.product_id),
    ]);
    return {
      dossier: { id: dossier.id, home_repo: dossier.home_repo, prd },
      approval,
      ...(await approvedOf(approval)),
      voids,
      members: members.map((m) => m.user_id),
      asked: await asked,
      workspace: workspaces[0]?.name ?? null,
      product,
    };
  }

  return {
    /** What the member reads of dossier `id`'s approval record. */
    async facts(id: string): Promise<AttestationFacts | 'not-found' | { repoBorn: PrdNumber }> {
      const [dossier] = await read(db.from('dossiers').select('id, workspace_id, home_repo, prd, kind, birthplace, product_id').eq('id', id).limit(1), DossierRow, 'the dossier');
      if (!dossier || dossier.prd === null || (dossier.kind ?? 'prd') !== 'prd') return 'not-found';
      const prd = parsePrd(dossier.prd);
      return dossier.birthplace === 'server' ? factsOf(dossier, prd) : { repoBorn: prd };
    },
  };
}
