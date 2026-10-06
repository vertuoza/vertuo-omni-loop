'use client';
import { useEffect, useRef, useState } from 'react';
import { copyLink } from '../../ask/page/share';

// Copy link, in the dossier's header (PRD 216): the page's own address, on the host it was opened on,
// to the clipboard; where the browser refuses, the link shows selected for the person to copy.

export function CopyLink({ path }: { path: string }) {
  const [state, setState] = useState<'idle' | 'copied' | 'selected'>('idle');
  const field = useRef<HTMLInputElement>(null);
  const link = () => `${window.location.origin}${path}`;

  useEffect(() => {
    if (state === 'selected') field.current?.select();
  }, [state]);

  async function copy() {
    setState(await copyLink(link(), navigator.clipboard, () => {}));
  }

  return (
    <span className="dossier-copy">
      <button type="button" className="ask-button" onClick={() => void copy()}>Copy link</button>
      {state === 'copied' && <span className="ask-hint" role="status">Copied.</span>}
      {state === 'selected' && (
        <>
          <input ref={field} className="ask-share-link" readOnly value={link()} aria-label="Link to this PRD" onFocus={(e) => { e.target.select(); }} />
          <span className="ask-hint" role="status">The link is selected: copy it with Ctrl+C, or ⌘C on a Mac.</span>
        </>
      )}
    </span>
  );
}
