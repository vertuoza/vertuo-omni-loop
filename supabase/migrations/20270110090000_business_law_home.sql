-- A product's law home (PRD 2632 s2, docs: .omni-loop/delivery/inbox/2632-business-laws/spec.md).
--
-- A business law lives in Git, in one repository of the product: its **law home**, the plan repository
-- when products.plan_repository is set, else its only repository, else none (several repositories and no
-- plan repository: nothing is judged until an owner sets one). Every terminal and the App read it, so
-- `omni check knowledge` can name the home when a law sits elsewhere, and `omni kb business-laws` can
-- read the home's pack away from it.
--
-- product_knowledge_for_agents() (20270109090000_product_domains.sql) is what business_for_product() and
-- business_for_repo_app() append to their answer, so both gain `lawHome`: the repository's `owner/name`,
-- or null. A reply without the key (an older server) reads as none in the kit. Nothing else changes:
-- same signature, same grants (internal, revoked from everyone).
--
-- Rollback: create or replace the function again as 20270109090000_product_domains.sql has it.

create or replace function public.product_law_home(p_product uuid) returns text
language sql stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select p.plan_repository from public.products p where p.id = p_product),
    (select min(l.repository) from public.product_repositories l where l.product_id = p_product
      having count(*) = 1))
$$;

revoke execute on function public.product_law_home(uuid) from public, anon, authenticated, service_role;

create or replace function public.product_knowledge_for_agents(p_product uuid) returns jsonb
language sql stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'legal', (select coalesce(jsonb_agg(jsonb_build_object(
                       'id', 'L-' || l.code || '-' || l.number, 'statement', l.statement, 'source', l.source,
                       'owner', case when l.owner_id is not null then public.member_login(l.workspace_id, l.owner_id) end)
                     order by l.code collate "C", l.number), '[]'::jsonb)
                from public.product_legal l where l.product_id = p_product and l.retired_at is null),
    'glossary', (select coalesce(jsonb_agg(jsonb_build_object('term', g.term, 'meaning', g.meaning, 'avoid', to_jsonb(g.avoid),
                        'domains', (select coalesce(jsonb_agg(dm.key order by dm.key collate "C"), '[]'::jsonb)
                                      from public.product_glossary_domains lk join public.product_domains dm on dm.id = lk.domain_id
                                     where lk.glossary_id = g.id and dm.retired_at is null))
                        order by lower(g.term), g.term), '[]'::jsonb)
                   from public.product_glossary g where g.product_id = p_product and g.removed_at is null),
    'domains', (select coalesce(jsonb_agg(jsonb_build_object('key', dm.key, 'name', dm.name, 'meaning', dm.meaning)
                        order by dm.key collate "C"), '[]'::jsonb)
                  from public.product_domains dm where dm.product_id = p_product and dm.retired_at is null),
    'lawHome', to_jsonb(public.product_law_home(p_product)))
$$;
