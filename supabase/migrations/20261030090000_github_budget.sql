-- The GitHub budget (PRD 902, s1, docs: .omni-loop/delivery/inbox/0902-github-budget/spec.md): what the
-- shared GitHub client (packages/github) keeps between calls, so galaxy and omni-app, on every server
-- instance, spend one installation's hourly budget together and knowingly.
--
-- - github_etags: one row per (installation, URL) read with a GET. The ETag GitHub gave and the body it
--   answered: the next read sends If-None-Match, and a 304, which GitHub does not count, answers the
--   stored body. read_at says when it last answered; the stages sync may drop rows unread for 7 days.
-- - github_budget: one row per (installation, resource), `core` or `graphql` (GitHub's x-ratelimit-resource):
--   the last answer's limit, remaining and reset, and paused_until, set when GitHub said the limit is
--   spent; until then no call for that installation and resource is sent, from either app.
--
-- Neither table is anyone's to read in a browser: only the service role reads and writes them, as it
-- writes prd_stages and fix_facts. No row names a workspace: an installation is GitHub's, and
-- workspaces.github_installation_id is unique, so a workspace's budget is its installation's row.
--
-- Rollback: a follow-up migration drops both tables. The client then calls GitHub plain, as a store
-- failure already does.

create table public.github_etags (
  installation_id bigint not null check (installation_id > 0),
  url             text not null check (url like 'https://api.github.com/%'),
  etag            text not null check (etag <> ''),
  body            text not null,
  content_type    text,
  read_at         timestamptz not null default now(),
  primary key (installation_id, url)
);

create index github_etags_read_at_idx on public.github_etags (read_at);

comment on table public.github_etags is
  'GitHub answers kept by their ETag, per App installation and URL, so a repeated read is a 304. Service role only.';
comment on column public.github_etags.installation_id is 'The GitHub App installation whose token read it.';
comment on column public.github_etags.url is 'The full api.github.com URL of the GET.';
comment on column public.github_etags.body is 'The answer''s body as GitHub sent it, returned on a 304.';
comment on column public.github_etags.read_at is 'When GitHub last answered it, 200 or 304.';

create table public.github_budget (
  installation_id bigint not null check (installation_id > 0),
  resource        text not null check (resource ~ '^[a-z_]+$'),
  "limit"         integer not null check ("limit" >= 0),
  remaining       integer not null check (remaining >= 0),
  reset_at        timestamptz not null,
  paused_until    timestamptz,
  updated_at      timestamptz not null default now(),
  primary key (installation_id, resource)
);

comment on table public.github_budget is
  'Each App installation''s GitHub rate limit per resource, as its last answer reported it, and the pause both apps respect. Service role only.';
comment on column public.github_budget."limit" is 'x-ratelimit-limit: the calls the window allows.';
comment on column public.github_budget.remaining is 'x-ratelimit-remaining: background calls stop below 20% of the limit.';
comment on column public.github_budget.reset_at is 'x-ratelimit-reset: when the window resets.';
comment on column public.github_budget.paused_until is 'Set when GitHub answered that the limit is spent: no call is sent before it.';

-- ── Who may do what ─────────────────────────────────────────────────────────────

alter table public.github_etags enable row level security;
alter table public.github_budget enable row level security;
-- No policy: no browser role reads or writes either table.

-- Explicit grants, and nothing more (config.toml › auto_expose_new_tables = false).
revoke all on public.github_etags, public.github_budget from public, anon, authenticated, service_role;
-- The client, as the service role: read, add, refresh; the sync drops ETag rows unread for 7 days.
grant select, insert, update, delete on public.github_etags to service_role;
grant select, insert, update on public.github_budget to service_role;
