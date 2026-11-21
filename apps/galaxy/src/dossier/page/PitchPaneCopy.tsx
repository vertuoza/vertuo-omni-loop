'use client';
import { useState } from 'react';
import { Button, Code, Text } from '@omni/ui';
import { copyLink } from '../../ask/page/share';

// Copy GIF link, in the Pitch section of the Retro tab (PRD 859 s3; Calm 2, omni-loop-20 s13): the pitch's
// stable GIF link, on the host the page was opened on, to the clipboard. It opens without signing in, like
// Proof's. Where the browser refuses, the link is written out for the person to copy by hand, as Copy link
// does (./CopyLink.tsx).

export function PitchPaneCopy({ path }: { path: string }) {
  const [state, setState] = useState<'idle' | 'copied' | 'selected'>('idle');
  const link = () => `${window.location.origin}${path}`;

  async function copy() {
    setState(await copyLink(link(), navigator.clipboard, () => {}));
  }

  return (
    <span className="dossier-copy">
      <Button variant="quiet" size="sm" onClick={() => void copy()}>Copy GIF link</Button>
      <span role="status">
        {state === 'copied' && <Text as="span" size="small" tone="secondary">Copied.</Text>}
        {state === 'selected' && (
          <>
            <Code>{link()}</Code>{' '}
            <Text as="span" size="small" tone="secondary">The browser would not copy it: select the link and copy it with Ctrl+C, or ⌘C on a Mac.</Text>
          </>
        )}
      </span>
    </span>
  );
}
