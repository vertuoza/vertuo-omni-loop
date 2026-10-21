-- The checks' own workspace, Initech: no check of its own, but the cast a check includes right after
-- its `begin;` with `\ir fixtures/initech.sql`, so it is rolled back with the check (PRD 2305).
-- A fresh install seeds no workspace, and the demo seed's Nimbus owns the `demo-org` organisation,
-- so a check that needs a workspace already playing builds this one: its fleets, its sectors and
-- its tracked repositories. Every name in it is fictional.

insert into public.workspaces (slug, name, github_org, plan_repo, theme)
values ('initech', 'Initech', 'initech', 'nimbus-plan', '{}');

-- Six fleets in the library's mascots; INVINCIBLE is retired, so history that names it keeps its look.
insert into public.teams (workspace_id, name, label, color, motto, mascot, sort, retired_at)
select w.id, f.name, f.label, f.color, f.motto, f.mascot, f.sort, f.retired_at
  from public.workspaces w,
       (values
         ('beaver',          'BEAVER',     '#d08a4a', 'Builds the dam. Secures the zone.', 'beaver',     10, null::timestamptz),
         ('octopod',         'OCTOPOD',    '#b07cff', 'Eight arms, eight sub-PRs.',        'octopod',    20, null),
         ('picsou',          'PICSOU',     '#ffd84a', 'Every coin counted twice.',         'picsou',     30, null),
         ('cia',             'C.I.A.',     '#9aa3c8', 'Knows every open question.',        'cia',        40, null),
         ('pirates',         'PIRATES',    '#2fc6a4', 'Takes the zones nobody claims.',    'pirate',     50, null),
         ('invincible-team', 'INVINCIBLE', '#4fb0ff', 'Think, Mark. Then ship it.',        'invincible', 90, now())
       ) as f (name, label, color, motto, mascot, sort, retired_at)
 where w.slug = 'initech';

insert into public.sectors (workspace_id, name, repos)
select w.id, s.name, s.repos
  from public.workspaces w,
       (values
         ('omni-core', array['nimbus-plan']::text[]),
         ('ai-nebula', array['nimbus-brain']::text[]),
         ('flow-rim',  array['nimbus-workflow-domain']::text[])
       ) as s (name, repos)
 where w.slug = 'initech';

insert into public.repositories (workspace_id, full_name)
select w.id, r.full_name
  from public.workspaces w
 cross join (values
   ('initech/nimbus-brain'),
   ('initech/nimbus-workflow-domain'),
   ('initech/nimbus-plan'),
   ('initech/nimbus-backend-php'),
   ('initech/nimbus-apps'),
   ('initech/pdf-builder')
 ) as r (full_name)
 where w.slug = 'initech';
