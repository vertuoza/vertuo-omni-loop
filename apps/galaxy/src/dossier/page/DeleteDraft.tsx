'use client';
import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '../../../../../supabase/database.types.ts';
import { deleteDraft } from './source';
import { dossierPath } from './view';

// Delete draft, in the Actions menu of a draft's page for its opener only (PRD 216, omni-loop-20 s6): a
// spike, an idea dropped. It deletes as the signed-in person, so the table's policy decides (the opener,
// their own draft; nobody deletes a numbered dossier), then reloads the address saying it is gone. The
// questions asked while it was open are not touched: they stay in the ask history.

type Supabase = { url: string; key: string };

/** What the browser asks before it deletes. */
export const DELETE_CONFIRM = 'Delete this draft for good? Its link stops working; its questions stay in the ask history.';

/** Deletes the draft once the person confirms, then reloads its address saying it is gone; the problem in
 * words when it was not deleted, null when it was or the person said no. */
export async function removeDraft(supabase: Supabase, id: string, confirm: (question: string) => boolean = (q) => window.confirm(q)): Promise<string | null> {
  if (!confirm(DELETE_CONFIRM)) return null;
  try {
    if (await deleteDraft(createBrowserClient<Database>(supabase.url, supabase.key), id)) {
      window.location.assign(`${dossierPath(id)}?deleted=1`);
      return null;
    }
    return 'This draft could not be deleted: only the person who opened it can, and only until it has a PRD number.';
  } catch {
    return 'The draft was not deleted. Check your connection and try again.';
  }
}
