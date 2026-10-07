// The screenshots' migration (PRD 620), read as text: the bucket's limits, the rules on its objects,
// the column's check and grant, and the round's guard keeping them final with the answer. What the
// rules let through is the database's to prove; this pins that each is there, as the spec asks.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { ATTACHMENTS_BUCKET } from './store';
import { present } from './test/test-item';

const MIGRATION = readFileSync(fileURLToPath(new URL('../../../../supabase/migrations/20261010090000_ask_attachments.sql', import.meta.url)), 'utf8');
const oneLine = MIGRATION.replace(/\s+/g, ' ');

/** Every rule the migration creates on storage.objects: its command and its whole text. */
function storageRules() {
  return [...MIGRATION.matchAll(/create policy "([^"]+)" on storage\.objects\s+for (\w+)([\s\S]*?);/g)]
    .map(([, name, command, rest]) => ({ name: present(name, 'the rule\'s name'), command: present(command, 'the rule\'s command'), text: present(rest, 'the rule\'s text').replace(/\s+/g, ' ') }));
}

describe('the ask-attachments migration', () => {
  it('creates the private bucket the store names: 5 MB a file, PNG, JPEG, GIF and WebP only', () => {
    expect(ATTACHMENTS_BUCKET).toBe('ask-attachments');
    expect(oneLine).toContain("insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) "
      + "values ('ask-attachments', 'ask-attachments', false, 5242880, array['image/png', 'image/jpeg', 'image/gif', 'image/webp'])");
  });

  it('keys every screenshot on its round: <round id>/<n>.<ext>, n from 1 to 5', () => {
    expect(MIGRATION).toContain("'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[1-5]\\.(png|jpg|jpeg|gif|webp)$'");
  });

  it('has an insert, a select and a delete rule on the bucket, and no update rule', () => {
    const rules = storageRules();
    expect(rules.map((r) => r.command).sort()).toEqual(['delete', 'insert', 'select']);
    for (const rule of rules) {
      expect(rule.name.length).toBeLessThanOrEqual(63);
      expect(rule.text).toContain("bucket_id = 'ask-attachments'");
    }
    const byCommand = Object.fromEntries(rules.map((r) => [r.command, r.text]));
    expect(byCommand.insert).toContain('with check (bucket_id = \'ask-attachments\' and public.ask_may_answer(public.ask_attachment_round(name)))');
    expect(byCommand.select).toContain('select 1 from public.ask_rounds r where r.id = public.ask_attachment_round(name)');
    expect(byCommand.delete).toContain('owner_id = (select auth.uid())::text and public.ask_may_answer(public.ask_attachment_round(name))');
    expect(byCommand.delete).toContain('or public.ask_owns_round(public.ask_attachment_round(name))');
    expect(MIGRATION).not.toMatch(/on storage\.objects\s+for update/);
  });

  it('lets in to upload exactly who may answer the open round: its session\'s owner, or a member it is shared with', () => {
    expect(oneLine).toContain("r.status = 'open' and ((s.owner = (select auth.uid()) and public.has_workspace()) or public.ask_shared_with_me(r.id))");
  });

  it('adds ask_rounds.attachments under its check, and lets the page write it', () => {
    expect(oneLine).toContain('alter table public.ask_rounds add column attachments jsonb;');
    expect(oneLine).toContain('add constraint ask_attachments_valid check (attachments is null or public.ask_attachments_valid(id, attachments))');
    expect(oneLine).toContain('when jsonb_array_length(e.value) not between 1 and 5 then true');
    expect(oneLine).toContain("public.ask_attachment_round(p #>> '{}') is distinct from round");
    expect(oneLine).toContain('grant update (attachments) on public.ask_rounds to authenticated;');
  });

  it('keeps the screenshots final with the answer: set only by the page\'s answer, never changed after', () => {
    expect(oneLine).toContain('create or replace function public.ask_rounds_guard()');
    expect(oneLine).toContain("if new.attachments is distinct from old.attachments then raise exception 'This round is already %: its screenshots cannot change.'");
    expect(oneLine).toContain("and not (new.status = 'answered' and old.status <> 'answered' and new.answered_via = 'page') then");
    // Everything the guard did before stays.
    expect(oneLine).toContain("raise exception 'This round is already %: its answer cannot change.'");
    expect(oneLine).toContain("raise exception 'An ask round cannot go from % to %.'");
    expect(oneLine).toContain('new.answered_by := case');
  });
});
