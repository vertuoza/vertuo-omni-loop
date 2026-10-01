'use client';
import { useEffect, useRef, useState } from 'react';
import { copyLink } from '../../ask/page/share';

// Copy GIF link, on the Pitch tab (PRD 859 s3): the pitch's stable GIF link, on the host the page was
// opened on, to the clipboard. It opens without signing in, like Proof's. Where the browser refuses, the
// link shows selected for the person to copy, as Copy link does (./CopyLink.tsx).

export function PitchPaneCopy({ path }: { path: string }) {
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
      <button type="button" className="ask-button quiet" onClick={copy}>Copy GIF link</button>
      {state === 'copied' && <span className="ask-hint" role="status">Copied.</span>}
      {state === 'selected' && (
        <>
          <input ref={field} className="ask-share-link" readOnly value={link()} aria-label="Link to the GIF" onFocus={(e) => e.target.select()} />
          <span className="ask-hint" role="status">The link is selected: copy it with Ctrl+C, or ⌘C on a Mac.</span>
        </>
      )}
    </span>
  );
}
