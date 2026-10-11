// Who may use ask mode, read from the migrations that decide it as text: the workspace a session
// goes to (20261004090000_workspace_gate.sql) and who reads, keeps, closes and deletes it
// (20260927100000_ask_workspace.sql). What the rules let through is the database's to prove
// (supabase/checks/ask.sql); this pins that each rule is there.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

function migration(name: string): string {
  return readFileSync(fileURLToPath(new URL(`../../../../supabase/migrations/${name}`, import.meta.url)), 'utf8')
    .replace(/--[^\n]*/g, '')
    .replace(/\s+/g, ' ');
}

const GATE = migration('20261004090000_workspace_gate.sql');
const WORKSPACE = migration('20260927100000_ask_workspace.sql');

/** The body of one function the migration creates, between its $$ quotes. */
function body(sql: string, fn: string): string {
  const match = new RegExp(`function public\\.${fn}\\([^$]*\\$\\$(.*?)\\$\\$`).exec(sql);
  if (!match?.[1]) throw new Error(`no function ${fn} in the migration`);
  return match[1];
}

describe('who may use ask mode', () => {
  // Law BR-PRODUCT-29 (.omni-loop/knowledge/product/rules.md, #1490).
  it('law BR-PRODUCT-29: membership is the only gate, and only a session\'s owner keeps, closes or deletes it', () => {
    const pick = body(GATE, 'repo_workspace');
    // Never an email domain: the pick reads workspace membership and the repository's owner only.
    expect(pick).not.toMatch(/email/i);
    // The workspace that owns the repository, when the person is a member of it.
    expect(pick).toContain('where m.user_id = person and v_owner <> \'\' and lower(w.github_org) = v_owner');
    // Refused when another workspace owns it.
    expect(pick).toContain('refusal := format(\'you are not a member of %s, which owns %s\', owning, shown);');
    // No workspace owns it: the person's first workspace, and refused when they belong to none.
    expect(pick).toContain('where m.user_id = person order by m.joined_at, w.slug limit 1; if workspace_id is null then refusal := format(\'no workspace owns %s yet');
    // The session opens where the pick says, or not at all.
    const place = body(GATE, 'ask_sessions_place');
    expect(place).toContain('select * into pick from public.repo_workspace(new.owner, new.repo); if pick.workspace_id is null then raise exception');
    expect(place).toContain('new.workspace_id := pick.workspace_id;');

    // Every member of the workspace reads its sessions and rounds.
    expect(WORKSPACE).toContain('alter policy "a person sees their own ask sessions" on public.ask_sessions using (public.is_member(workspace_id));');
    expect(WORKSPACE).toContain('alter policy "a person sees the rounds of their own sessions" on public.ask_rounds using (exists ( select 1 from public.ask_sessions s where s.id = session_id and public.is_member(s.workspace_id)));');
    // Only the owner keeps, closes or deletes it.
    expect(WORKSPACE).toContain('alter policy "a person keeps and closes their own ask sessions" on public.ask_sessions using (owner = (select auth.uid()) and public.is_member(workspace_id)) with check (owner = (select auth.uid()));');
    expect(WORKSPACE).toContain('create policy "a person deletes their own ask sessions" on public.ask_sessions for delete to authenticated using (owner = (select auth.uid()));');
  });
});
