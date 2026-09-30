'use client';
import { useState } from 'react';
import { renderMarkdownBody } from '../../dossier/markdown';
import { leadFolds, leadOf } from './lead';

// "Claude wrote before asking" (PRD 752): the text of Claude's last message before the round, shown
// once above its questions as the dossier's safe markdown (raw HTML shown as text). A long one is
// folded after about 12 lines behind "Show all". A round without a lead shows nothing.

export function LeadMessage({ lead }: { lead: string | null | undefined }) {
  const [open, setOpen] = useState(false);
  const text = leadOf({ lead });
  if (!text) return null;
  const folded = !open && leadFolds(text);
  return (
    <section className="ask-lead-msg" aria-label="Claude wrote before asking">
      <h2 className="ask-lead-msg-title">Claude wrote before asking</h2>
      <div className={folded ? 'ask-prose ask-lead-msg-body is-folded' : 'ask-prose ask-lead-msg-body'} dangerouslySetInnerHTML={{ __html: renderMarkdownBody(text) }} />
      {folded && <button type="button" className="ask-lead-msg-more" onClick={() => setOpen(true)}>Show all</button>}
    </section>
  );
}
