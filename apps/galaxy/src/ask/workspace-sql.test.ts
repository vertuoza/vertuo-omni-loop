// The question-history migration (PRD 144), read as text: what it does with a session whose owner
// belongs to no workspace. What the rules let through is the database's to prove; this pins that the
// rules and the backfill are written so, as the law asks.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const MIGRATION = readFileSync(fileURLToPath(new URL('../../../../supabase/migrations/20260927100000_ask_workspace.sql', import.meta.url)), 'utf8');
const oneLine = MIGRATION.replace(/\s+/g, ' ');

describe('the ask-workspace migration', () => {
  // Law BR-PRODUCT-39 (.omni-loop/knowledge/product/rules.md, #1500).
  it('law BR-PRODUCT-39: keeps a session of no workspace, unread by anyone, its owner included, and never deletes it', () => {
    // Kept: the column may stay null, the backfill leaves it null for an owner in no workspace, and
    // nothing in the change deletes a session.
    expect(oneLine).toContain('alter table public.ask_sessions add column workspace_id uuid references public.workspaces (id) on delete cascade;');
    expect(oneLine).not.toMatch(/workspace_id[^;]*set not null/);
    expect(oneLine).toContain('update public.ask_sessions s set workspace_id = public.ask_session_workspace(s.owner, s.repo);');
    expect(oneLine).not.toMatch(/delete from public\.ask_sessions/);
    // Unread by anyone: reading the session or its rounds asks for membership of its workspace alone,
    // with no way in for its owner.
    expect(oneLine).toContain('alter policy "a person sees their own ask sessions" on public.ask_sessions using (public.is_member(workspace_id));');
    expect(oneLine).toContain('alter policy "a person sees the rounds of their own sessions" on public.ask_rounds using (exists ( select 1 from public.ask_sessions s where s.id = session_id and public.is_member(s.workspace_id)));');
  });
});
