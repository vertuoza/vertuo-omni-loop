import type { SupabaseClient, User } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
import type { Database } from '../../../../supabase/database.types.ts';
import { loadSettingsPage } from './load';
import type { PlaybookPagesView } from './omni-settings.contract';
import type { OmniSettingsPagesService } from './omni-settings.service';

// Settings → Playbook's read (PRD 2417, s6): the person's first workspace, then its playbook; a
// person in no workspace, a workspace they cannot read and a read that fails each have a name.

const USER: Pick<User, 'id'> = { id: 'u-ada' };
const VIEW: PlaybookPagesView = { repository: 'acme/plan', commit: '3f2a9c1e0b7d4c5a8e6f1d2c3b4a5968778695a4', reason: null, pages: [{ form: 'review', text: 'x', source: 'kit' }] };

/** A client whose membership read answers `rows` (or fails with `error`). */
function dbOf(rows: unknown[], error: string | null = null): SupabaseClient<Database> {
  const answer = Promise.resolve({ data: error === null ? rows : null, error: error === null ? null : { message: error } });
  return { from: () => ({ select: () => ({ eq: () => answer }) }) } as unknown as SupabaseClient<Database>;
}
const member = [{ joined_at: '2026-01-01T00:00:00Z', workspace: { id: 'w-acme', slug: 'acme', name: 'Acme', theme: {} } }];
const serviceOf = (pages: OmniSettingsPagesService['pages']): OmniSettingsPagesService => ({ pages });

describe('loading the playbook page', () => {
  it('reads the playbook of the person\'s workspace', async () => {
    const pages = vi.fn(() => Promise.resolve(VIEW));
    expect(await loadSettingsPage(dbOf(member), USER, serviceOf(pages))).toEqual({ kind: 'playbook', workspace: { id: 'w-acme', name: 'Acme' }, ...VIEW });
    expect(pages).toHaveBeenCalledWith('w-acme');
  });

  it('says a person in no workspace is in none', async () => {
    expect(await loadSettingsPage(dbOf([]), USER, serviceOf(() => Promise.resolve(VIEW)))).toEqual({ kind: 'no-workspace' });
  });

  it('is unreadable when the workspace is not readable, the read fails or no service is configured', async () => {
    const quiet = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(await loadSettingsPage(dbOf(member), USER, serviceOf(() => Promise.resolve(null)))).toEqual({ kind: 'unreadable' });
    expect(await loadSettingsPage(dbOf(member), USER, serviceOf(() => Promise.reject(new Error('boom'))))).toEqual({ kind: 'unreadable' });
    expect(await loadSettingsPage(dbOf([], 'down'), USER, serviceOf(() => Promise.resolve(VIEW)))).toEqual({ kind: 'unreadable' });
    expect(await loadSettingsPage(dbOf(member), USER, null)).toEqual({ kind: 'unreadable' });
    quiet.mockRestore();
  });
});
