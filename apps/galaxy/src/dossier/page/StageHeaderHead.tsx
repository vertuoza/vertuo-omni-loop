'use client';
import { useState, type ReactNode } from 'react';
import { Notice, PageHeader, type MenuItem, type PageHeaderMeta } from '@omni/ui';
import { removeDraft } from './DeleteDraft';
import { RequestTechApproval } from './RequestTechApproval';

// The head of /prd/<id> and of a fix's page on @omni/ui's PageHeader (omni-loop-20 s6): the eyebrow, the
// 32 px title, the subtitle naming who acts next, the meta row, then Copy link and the one primary, and
// the Actions menu for the rare actions. The menu runs in the browser: Delete draft asks, deletes and
// reloads (DeleteDraft.tsx); Request a Tech Approval opens its panel under the head
// (RequestTechApproval.tsx). The server hands the primary and Copy link in as drawn parts.

type Props = {
  title: string;
  eyebrow: string;
  lede: string | null;
  meta: PageHeaderMeta;
  /** The one primary, for the person who acts; absent for anyone else. */
  action?: ReactNode;
  /** Copy link. */
  secondary?: ReactNode;
  actions: readonly MenuItem[];
  /** Where Delete draft deletes from, with the draft's id; null when the viewer may not delete it. */
  draft: { supabase: { url: string; key: string }; id: string } | null;
  /** The dossier a Tech Approval is requested for. */
  dossier: string;
};

export function DossierHead({ title, eyebrow, lede, meta, action, secondary, actions, draft, dossier }: Props) {
  const [tech, setTech] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  async function pick(id: string) {
    if (id === 'request-tech') setTech(true);
    if (id === 'delete-draft' && draft) setProblem(await removeDraft(draft.supabase, draft.id));
  }

  return (
    <>
      <PageHeader
        title={title}
        eyebrow={eyebrow}
        {...(lede === null ? {} : { lede })}
        meta={meta}
        {...(action === undefined ? {} : { action })}
        {...(secondary === undefined ? {} : { secondary })}
        actions={actions}
        onAction={(id) => void pick(id)}
      />
      {problem && <Notice tone="danger">{problem}</Notice>}
      {tech && <RequestTechApproval dossier={dossier} />}
    </>
  );
}
