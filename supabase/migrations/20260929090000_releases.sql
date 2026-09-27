-- Release notes (PRD 262, docs: .omni-loop/delivery/inbox/0262-release-notes/spec.md): one row per
-- shipped PRD, stamped once with its version and date, and read by anyone, signed in or not, on the
-- galaxy app's public /releases page.
--
-- The text lives in the repository (each shipped PRD's release.md); this table is its projection. The
-- sync (pnpm releases:sync, run by .github/workflows/releases.yml as the service role) adds what the
-- repository cannot know before the merge: the release number, shown as 0.0.<release>, and the date
-- the PRD's shipped folder first reached main. A PRD's number and date are written once and never
-- change; only its title and description are refreshed from its note. The sync never deletes a row:
-- removing a published release is a person's decision, made in the database.
--
-- The first table anyone on the internet may read: it holds only release copy. Anyone reads it;
-- nobody but the service role writes it, and the service role only adds rows and refreshes their text
-- (supabase/checks/releases.sql).
--
-- Rollback: a follow-up migration drops the table. Nothing else in the database reads it.

create table public.releases (
  prd         integer primary key check (prd > 0),
  release     integer not null check (release >= 1),
  released_at timestamptz not null,
  title       text not null check (btrim(title) <> ''),
  description text not null default ''
);

-- Every release above 1 is one PRD's own. Release 1, the initial release, is shared by every PRD
-- shipped before release notes existed.
create unique index releases_release_idx on public.releases (release) where release > 1;

comment on table public.releases is
  'One row per shipped PRD: its version (0.0.<release>), when it reached main, and its release note. Public. Written only by the service role (pnpm releases:sync).';
comment on column public.releases.release is
  'The patch number, shown as 0.0.<release>. 1 is the initial release, shared; above 1, one PRD each. Stamped once, never changed.';
comment on column public.releases.released_at is
  'The committer date of the first commit on main that holds the PRD''s shipped spec.md. Stamped once, never changed.';
comment on column public.releases.title is 'The release note''s title, or the spec''s title while the PRD has no note.';
comment on column public.releases.description is 'The release note''s description; empty while the PRD has no note.';

-- ── Who may do what ─────────────────────────────────────────────────────────────

alter table public.releases enable row level security;

-- Reading: anyone, signed in or not.
create policy "anyone reads the releases" on public.releases
  for select to anon, authenticated
  using (true);

-- Explicit grants, and nothing more: everything revoked first, then granted, whether or not the
-- project grants new tables to the API roles by default (config.toml › auto_expose_new_tables).
revoke all on public.releases from public, anon, authenticated, service_role;
grant select on public.releases to anon, authenticated;
-- The sync, as the service role: it reads the table, adds a row for a newly shipped PRD, and refreshes
-- a row's title and description. It never renumbers, redates or deletes one.
grant select, insert on public.releases to service_role;
grant update (title, description) on public.releases to service_role;
