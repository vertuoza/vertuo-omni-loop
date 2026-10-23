import type { SupabaseClient, User } from '@supabase/supabase-js';
import { log } from 'omni-loop/kit/lib/log/log.ts';
import type { Database } from '../../../../supabase/database.types.ts';
import { memberWorkspace } from '../data/workspace';
import type { PlaybookPagesView } from './omni-settings.contract';
import type { OmniSettingsPagesService } from './omni-settings.service';

// Settings → Playbook's read (PRD 2417, s6). As the signed-in person, so row-level security decides
// what returns: their workspace (the one joined first, as every settings page's), then its settings
// repository's tech playbook through the pages service, which reads GitHub as the Omni app. A workspace
// that cannot be read, or a playbook that cannot, reads as `unreadable`; a workspace with no settings
// repository is not a failure: the view says so, with the one thing to do. Whether they own the
// workspace (s7: an owner gets each page's edit) is read beside it; a role that cannot be read reads as
// a member's, so the page still shows, without its edit.

export type SettingsPageLoad =
  | { kind: 'no-workspace' }
  | { kind: 'unreadable' }
  | ({ kind: 'playbook'; workspace: { id: string; name: string }; owner: boolean } & PlaybookPagesView);

const why = (err: unknown) => (err instanceof Error ? err.message : String(err));

/** Whether the person owns the workspace; false, logged, when their role cannot be read. */
function ownerOf(service: OmniSettingsPagesService, workspace: string): Promise<boolean> {
  return service.owner(workspace).catch((err: unknown) => {
    log.warn({ event: 'omni-settings', message: 'your role could not be read: the playbook shows without its edit', error: err });
    return false;
  });
}

export async function loadSettingsPage(
  db: SupabaseClient<Database>,
  user: Pick<User, 'id'>,
  service: OmniSettingsPagesService | null,
): Promise<SettingsPageLoad> {
  if (!service) return { kind: 'unreadable' };
  try {
    const workspace = await memberWorkspace(db, user.id);
    if (!workspace) return { kind: 'no-workspace' };
    const [view, owner] = await Promise.all([service.pages(workspace.id), ownerOf(service, workspace.id)]);
    if (!view) return { kind: 'unreadable' };
    return { kind: 'playbook', workspace: { id: workspace.id, name: workspace.name }, owner, ...view };
  } catch (err) {
    console.error(`omni settings: the playbook page could not be read (${why(err)})`);
    return { kind: 'unreadable' };
  }
}
