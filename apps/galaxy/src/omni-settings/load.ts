import type { SupabaseClient, User } from '@supabase/supabase-js';
import type { Database } from '../../../../supabase/database.types.ts';
import { memberWorkspace } from '../data/workspace';
import type { PlaybookPagesView } from './omni-settings.contract';
import type { OmniSettingsPagesService } from './omni-settings.service';

// Settings → Playbook's read (PRD 2417, s6). As the signed-in person, so row-level security decides
// what returns: their workspace (the one joined first, as every settings page's), then its settings
// repository's tech playbook through the pages service, which reads GitHub as the Omni app. A workspace
// that cannot be read, or a playbook that cannot, reads as `unreadable`; a workspace with no settings
// repository is not a failure: the view says so, with the one thing to do.

export type SettingsPageLoad =
  | { kind: 'no-workspace' }
  | { kind: 'unreadable' }
  | ({ kind: 'playbook'; workspace: { id: string; name: string } } & PlaybookPagesView);

const why = (err: unknown) => (err instanceof Error ? err.message : String(err));

export async function loadSettingsPage(
  db: SupabaseClient<Database>,
  user: Pick<User, 'id'>,
  service: OmniSettingsPagesService | null,
): Promise<SettingsPageLoad> {
  if (!service) return { kind: 'unreadable' };
  try {
    const workspace = await memberWorkspace(db, user.id);
    if (!workspace) return { kind: 'no-workspace' };
    const view = await service.pages(workspace.id);
    if (!view) return { kind: 'unreadable' };
    return { kind: 'playbook', workspace: { id: workspace.id, name: workspace.name }, ...view };
  } catch (err) {
    console.error(`omni settings: the playbook page could not be read (${why(err)})`);
    return { kind: 'unreadable' };
  }
}
