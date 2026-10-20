-- Who wrote each Legal entry and glossary term, and when (PRD 2240 s1, docs:
-- .omni-loop/delivery/inbox/2240-product-knowledge-home/spec.md).
--
-- As 20261212110000_product_knowledge.sql, with three more fields on every entry product_knowledge_of()
-- answers, Legal and glossary alike, read from the columns product_legal and product_glossary already hold:
-- - createdBy: who added it, `{user, login}` as product_knowledge_person() answers a member, or null when
--   nobody is known (the author's account was deleted: `created_by` is `on delete set null`). An entry
--   that came by an approved proposal was added by the person who approved it.
-- - createdAt: when it was added.
-- - updatedAt: when it last changed (an edit, a retirement or a removal), its createdAt until then.
--
-- An additive change to a read: the fields only widen a JSON answer, so a page that does not read them
-- ignores them. Who may call it, and everything else it answers, is unchanged; `create or replace` keeps
-- its grants.

-- What the Knowledge tab of a product shows a member (42501 anyone else, P0002 another workspace's
-- product): `{product: {id, name}, canName, latestEventId, legal, glossary}`, where `canName` says the
-- reader may name owners and delegates, `latestEventId` is the product's newest event as text (or null),
-- and each kind is `{owner, delegate, decides, entries, proposals}`: owner and delegate `{user, login}`
-- or null (a named person who left the workspace is null), `decides` whether the reader adds, edits and
-- decides directly, `entries` every entry, retired and removed ones too (Legal: `{entry, id, code,
-- number, statement, source, owner, retiredAt, createdBy, createdAt, updatedAt}`, by code then number;
-- glossary: `{entry, term, meaning, avoid, removedAt, createdBy, createdAt, updatedAt}`, by term without
-- case, the live one first), `proposals` the open ones, oldest first (`{proposal, action, entry, fields,
-- proposedBy, proposedAt}`).
create or replace function public.product_knowledge_of(p_workspace uuid, p_product uuid) returns jsonb
language plpgsql stable
security definer
set search_path = ''
as $$
declare
  product public.products := public.product_knowledge_product(p_workspace, p_product);
  k text;
  sections jsonb := '{}'::jsonb;
begin
  foreach k in array array['legal', 'glossary'] loop
    sections := sections || jsonb_build_object(k, jsonb_build_object(
      'owner', public.product_knowledge_person(p_workspace,
                 (select n.user_id from public.product_knowledge_named(product.id, k) n where n.role = 'owner')),
      'delegate', public.product_knowledge_person(p_workspace,
                 (select n.user_id from public.product_knowledge_named(product.id, k) n where n.role = 'delegate')),
      'decides', public.product_knowledge_decides(product.id, k),
      'entries', case when k = 'legal' then
        (select coalesce(jsonb_agg(jsonb_build_object(
                  'entry', l.id, 'id', 'L-' || l.code || '-' || l.number, 'code', l.code, 'number', l.number,
                  'statement', l.statement, 'source', l.source,
                  'owner', public.product_knowledge_person(p_workspace, l.owner_id), 'retiredAt', l.retired_at,
                  'createdBy', public.product_knowledge_person(p_workspace, l.created_by),
                  'createdAt', l.created_at, 'updatedAt', l.updated_at)
                order by l.code collate "C", l.number), '[]'::jsonb)
           from public.product_legal l where l.product_id = product.id)
      else
        (select coalesce(jsonb_agg(jsonb_build_object(
                  'entry', g.id, 'term', g.term, 'meaning', g.meaning, 'avoid', to_jsonb(g.avoid), 'removedAt', g.removed_at,
                  'createdBy', public.product_knowledge_person(p_workspace, g.created_by),
                  'createdAt', g.created_at, 'updatedAt', g.updated_at)
                order by lower(g.term), g.removed_at nulls first, g.id), '[]'::jsonb)
           from public.product_glossary g where g.product_id = product.id)
      end,
      'proposals',
        (select coalesce(jsonb_agg(jsonb_build_object(
                  'proposal', x.id, 'action', x.action, 'entry', coalesce(x.legal_id, x.glossary_id), 'fields', x.fields,
                  'proposedBy', public.product_knowledge_person(p_workspace, x.proposed_by), 'proposedAt', x.proposed_at)
                order by x.proposed_at, x.id), '[]'::jsonb)
           from public.product_knowledge_proposals x where x.product_id = product.id and x.kind = k and x.state = 'open')));
  end loop;
  return jsonb_build_object(
    'product', jsonb_build_object('id', product.id, 'name', product.name),
    'canName', public.is_owner(p_workspace),
    'latestEventId', (select max(e.id)::text from public.product_knowledge_events e where e.product_id = product.id))
    || sections;
end;
$$;
