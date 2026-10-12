// The ask-mode migrations (PRD 71, PRD 144, PRD 620), read as text: how a round may move, that its
// answer is final, who deletes a session and what the hourly job does. What the rules let through is
// the database's to prove; this pins that the newest guard, the delete rule and the sweep are written
// so, as the law asks.
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const DIR = fileURLToPath(new URL('../../../../supabase/migrations/', import.meta.url));
const migrations = readdirSync(DIR).filter((f) => f.endsWith('.sql')).sort()
  .map((name) => ({ name, sql: readFileSync(`${DIR}${name}`, 'utf8').replace(/\s+/g, ' ') }));

/** The text of the newest migration that (re)defines a function, from its header to its closing `$$;`. */
function newestFunction(fn: string): string {
  const pattern = new RegExp(`create (?:or replace )?function public\\.${fn}\\(\\)[\\s\\S]*?\\$\\$;`);
  const found = migrations.flatMap((m) => m.sql.match(pattern) ?? []);
  const newest = found.at(-1);
  if (!newest) throw new Error(`no migration defines ${fn}`);
  return newest;
}

describe('the ask-mode migrations', () => {
  // Law BR-PRODUCT-12 (.omni-loop/knowledge/product/rules.md, #1474).
  it('law BR-PRODUCT-12: a round moves only forward with a final answer; only its owner deletes a session; the hourly job deletes nothing', () => {
    // A round: open → answered, open → abandoned, abandoned → answered from the terminal, nothing else;
    // with the status unchanged, the answer cannot change.
    const guard = newestFunction('ask_rounds_guard');
    expect(guard).toContain("if new.status is not distinct from old.status then if new.answers is distinct from old.answers or new.answered_via is distinct from old.answered_via then raise exception 'This round is already %: its answer cannot change.'");
    expect(guard).toContain("elsif not ( old.status = 'open' or (old.status = 'abandoned' and new.status = 'answered' and new.answered_via = 'terminal') ) then raise exception 'An ask round cannot go from % to %.'");
    const all = migrations.map((m) => m.sql).join(' ');
    expect(all).toContain("status text not null default 'open' check (status in ('open', 'answered', 'abandoned'))");
    expect(all).toContain('create trigger ask_rounds_guard before update on public.ask_rounds for each row execute function public.ask_rounds_guard();');
    expect(all).not.toMatch(/drop trigger[^;]*ask_rounds_guard/);

    // A session is deleted only by its owner, its rounds with it; nobody deletes a round alone.
    expect(all).toContain('create policy "a person deletes their own ask sessions" on public.ask_sessions for delete to authenticated using (owner = (select auth.uid()));');
    expect(all).not.toMatch(/alter policy "a person deletes their own ask sessions"/);
    expect(all).toContain('session_id uuid not null references public.ask_sessions (id) on delete cascade');
    expect(all).not.toMatch(/grant [^;]*delete[^;]* on public\.ask_rounds/);
    expect(all).not.toMatch(/on public\.ask_rounds for delete/);

    // The hourly clean-up closes idle sessions and deletes nothing.
    expect(all).toContain("select cron.unschedule('ask-expire'); drop function public.ask_expire();");
    const sweep = newestFunction('ask_sweep');
    expect(sweep).toContain("update public.ask_sessions s set status = 'closed'");
    expect(sweep).not.toMatch(/delete/i);
    expect(all).toContain("select cron.schedule('ask-sweep', '17 * * * *', 'select public.ask_sweep()');");
  });
});
