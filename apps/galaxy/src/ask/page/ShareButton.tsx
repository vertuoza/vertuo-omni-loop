'use client';
import { useId, useRef, useState } from 'react';
import { copyLink, shareLink } from './share';

// Share, on an open round (PRD 144): the owner picks a member of the workspace, and the page gives the
// link to paste wherever they like, with a copy button that falls back to selecting the text. The
// member then sees the round under For me, and answers it on the link while it is open.

type Candidate = { id: string; label: string };

type Props = {
  roundId: string;
  candidates: Candidate[];
  onShare: (member: string) => Promise<boolean>;
  /** The page's origin, for the link; the browser's own when left out. */
  origin?: string;
  /** Where it starts: closed, unless a test shows another stage. */
  initial?: ShareStage;
};

export type ShareStage = { kind: 'closed' } | { kind: 'picking' } | { kind: 'sharing' } | { kind: 'shared'; with: string; copy: 'idle' | 'copied' | 'selected' };

export function ShareButton({ roundId, candidates, onShare, origin, initial = { kind: 'closed' } }: Props) {
  const id = useId();
  const [stage, setStage] = useState<ShareStage>(initial);
  const [member, setMember] = useState(candidates[0]?.id ?? '');
  const [problem, setProblem] = useState<string | null>(null);
  const field = useRef<HTMLInputElement>(null);
  if (candidates.length === 0) return null;

  const link = shareLink(origin ?? (typeof window === 'undefined' ? '' : window.location.origin), roundId);
  const labelOf = (who: string) => candidates.find((c) => c.id === who)?.label ?? 'them';

  async function share() {
    setStage({ kind: 'sharing' });
    setProblem(null);
    try {
      if (await onShare(member)) setStage({ kind: 'shared', with: member, copy: 'idle' });
      else {
        setProblem('This question could not be shared: only the person who opened the session can, with a member of its workspace.');
        setStage({ kind: 'picking' });
      }
    } catch {
      setProblem('The question was not shared. Check your connection and try again.');
      setStage({ kind: 'picking' });
    }
  }

  async function copy() {
    const done = await copyLink(link, typeof navigator === 'undefined' ? undefined : navigator.clipboard, () => field.current?.select());
    setStage((s) => (s.kind === 'shared' ? { ...s, copy: done } : s));
  }

  if (stage.kind === 'closed') {
    return (
      <p className="ask-share">
        <button type="button" className="ask-button quiet" onClick={() => setStage({ kind: 'picking' })}>Share</button>
      </p>
    );
  }

  if (stage.kind === 'shared') {
    return (
      <section className="ask-share" aria-live="polite">
        <p className="ask-muted">Shared with {labelOf(stage.with)}. It shows under their Shared with me; send them the link:</p>
        <div className="ask-share-row">
          <input ref={field} id={`${id}-link`} className="ask-share-link" readOnly value={link} aria-label="Link to this question" onFocus={(e) => e.target.select()} />
          <button type="button" className="ask-button quiet" onClick={copy}>Copy</button>
        </div>
        {stage.copy === 'copied' && <p className="ask-hint">Copied.</p>}
        {stage.copy === 'selected' && <p className="ask-hint">The link is selected: copy it with Ctrl+C, or ⌘C on a Mac.</p>}
      </section>
    );
  }

  return (
    <section className="ask-share">
      <div className="ask-share-row">
        <label htmlFor={`${id}-member`} className="ask-muted">Share with</label>
        <select id={`${id}-member`} className="ask-share-pick" value={member} onChange={(e) => setMember(e.target.value)}>
          {candidates.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
        </select>
        <button type="button" className="ask-button" disabled={stage.kind === 'sharing' || !member} onClick={share}>
          {stage.kind === 'sharing' ? 'Sharing…' : 'Share'}
        </button>
        <button type="button" className="ask-button quiet" onClick={() => setStage({ kind: 'closed' })}>Cancel</button>
      </div>
      {problem && <p className="ask-problem" role="status">{problem}</p>}
    </section>
  );
}
