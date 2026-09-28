-- Send posts the reply as the person (PRD 251, docs: .omni-loop/delivery/inbox/0251-outbox-answers/spec.md,
-- "Send posts the reply as you"): each reply the Omni page's Outbox tab posts on a feature pull request,
-- as the person who sent it.
--
-- - outbox_sends: one row per send. Its owner inserts it (a member of the dossier's workspace), reads it,
--   and records its outcome once through outbox_send_done(). Nobody else reads it, and nobody deletes it.
--   The outbox itself is never stored: the page reads it from GitHub (the spec's Decision 2).
--
-- Rollback: a follow-up migration drops outbox_send_done() and outbox_sends. Nothing else reads them.

create table public.outbox_sends (
  id           uuid primary key default gen_random_uuid(),
  dossier_id   uuid not null references public.dossiers on delete cascade,
  owner        uuid not null default auth.uid() references auth.users on delete cascade,
  pr_number    integer not null check (pr_number > 0),
  reply        text not null check (length(reply) between 1 and 16384),
  nonce_hash   text not null check (char_length(nonce_hash) between 1 and 200),
  created_at   timestamptz not null default now(),
  posted_at    timestamptz,
  comment_url  text,
  login        text,
  counted      boolean,
  error        text
);

comment on table public.outbox_sends is
  'Each reply the Omni page posts on a feature pull request as a person. Only its owner reads it; its outcome is recorded once, by outbox_send_done().';
comment on column public.outbox_sends.nonce_hash is 'The hash of the nonce the callback must bring back; the nonce itself is never stored.';
comment on column public.outbox_sends.login is 'The GitHub account the reply was posted as.';
comment on column public.outbox_sends.counted is 'Whether its author_association is one omni replies counts.';

create index outbox_sends_owner_idx on public.outbox_sends (owner, created_at desc);

-- Records a send's outcome, once, for its owner only: posted (its comment's link, the account it was
-- posted as, whether the kit counts it) or failed (the error). Refused: 42501 signed out; P0002 no
-- send of the caller's; 22023 an outcome already recorded, or neither a link nor an error.
create function public.outbox_send_done(
  p_send        uuid,
  p_comment_url text default null,
  p_login       text default null,
  p_counted     boolean default null,
  p_error       text default null
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
  send   public.outbox_sends%rowtype;
begin
  if caller is null then
    raise exception 'Sign in first.' using errcode = '42501';
  end if;
  if (p_comment_url is null) = (p_error is null) then
    raise exception 'A send ends posted, with its link, or failed, with its error.' using errcode = '22023';
  end if;
  select s.* into send from public.outbox_sends s where s.id = p_send and s.owner = caller for update;
  if not found then
    raise exception 'No such send.' using errcode = 'P0002';
  end if;
  if send.posted_at is not null or send.error is not null then
    raise exception 'This send''s outcome is already recorded.' using errcode = '22023';
  end if;
  update public.outbox_sends s
     set posted_at = case when p_comment_url is null then null else now() end,
         comment_url = left(p_comment_url, 500),
         login = left(p_login, 100),
         counted = p_counted,
         error = left(p_error, 1000)
   where s.id = p_send;
end;
$$;

-- ── Who may do what ─────────────────────────────────────────────────────────────

alter table public.outbox_sends enable row level security;

create policy "the owner reads their own sends" on public.outbox_sends
  for select to authenticated
  using (owner = (select auth.uid()));

create policy "a member sends on their workspace's dossiers, as themselves" on public.outbox_sends
  for insert to authenticated
  with check (
    owner = (select auth.uid())
    and exists (select 1 from public.dossiers d where d.id = dossier_id and public.is_member(d.workspace_id))
  );

-- Explicit grants, and nothing more (config.toml › auto_expose_new_tables = false).
revoke all on public.outbox_sends from anon, authenticated, service_role;
grant select on public.outbox_sends to authenticated;
grant insert (dossier_id, pr_number, reply, nonce_hash) on public.outbox_sends to authenticated;

revoke execute on function public.outbox_send_done(uuid, text, text, boolean, text) from public, anon;
grant execute on function public.outbox_send_done(uuid, text, text, boolean, text) to authenticated;
