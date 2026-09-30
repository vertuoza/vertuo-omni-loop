-- A round's lead (PRD 752, spec: .omni-loop/delivery/inbox/0752-readable-questions/spec.md): the text
-- Claude wrote in the terminal just before it asked, so the person answering on the page reads what
-- they are asked to approve. The kit reads only the text blocks of Claude's last message before the
-- question from the transcript, capped at 16 KB plus a short note when cut (ADR-0002), and sends it
-- as `lead` with the round; the API checks it and stores it here.
--
-- One nullable column, written with the round by the caller who asks it. It is read by exactly who
-- reads the round already: no policy changes. An older kit sends no lead, and its rows carry null.
--
-- Rollback: nothing to undo in a hurry: a kit release that stops sending `lead` stops new ones, and the
-- column may stay. A follow-up migration may drop it, with its check and its grant.

alter table public.ask_rounds
  add column lead text check (lead is null or octet_length(lead) between 1 and 16640);

comment on column public.ask_rounds.lead is
  'The text Claude wrote before asking (PRD 752): the text blocks of its last message before the question, at most 16 KB plus the kit''s shortened note, or null when the kit sent none.';

-- Written with the round, by whoever asks it.
grant insert (lead) on public.ask_rounds to authenticated;
