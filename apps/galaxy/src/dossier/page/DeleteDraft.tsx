'use client';
import { useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { deleteDraft } from './source';
import { dossierPath } from './view';

// Delete draft, shown to the opener of a draft only (PRD 216): a spike, an idea dropped. It deletes as
// the signed-in person, so the table's policy decides (the opener, their own draft; nobody deletes a
// numbered dossier), then reloads the address saying it is gone. The questions asked while it was open
// are not touched: they stay in the ask history.

type Supabase = { url: string; key: string };

export function DeleteDraft({ supabase, id }: { supabase: Supabase; id: string }) {
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  async function remove() {
    if (busy || !window.confirm('Delete this draft for good? Its link stops working; its questions stay in the ask history.')) return;
    setBusy(true);
    setProblem(null);
    try {
      if (await deleteDraft(createBrowserClient(supabase.url, supabase.key), id)) {
        window.location.assign(`${dossierPath(id)}?deleted=1`);
        return;
      }
      setProblem('This draft could not be deleted: only the person who opened it can, and only until it has a PRD number.');
    } catch {
      setProblem('The draft was not deleted. Check your connection and try again.');
    }
    setBusy(false);
  }

  return (
    <span className="dossier-delete">
      <button type="button" className="ask-button quiet" disabled={busy} onClick={remove}>{busy ? 'Deleting…' : 'Delete draft'}</button>
      {problem && <span className="ask-problem" role="alert">{problem}</span>}
    </span>
  );
}
