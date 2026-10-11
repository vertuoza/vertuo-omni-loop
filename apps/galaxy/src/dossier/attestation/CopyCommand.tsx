'use client';
import { useState } from 'react';
import { copyLink } from '../../ask/page/share';

// Copy, beside `omni approval restore <n>` on a drifted attestation (PRD 1612 s4): the command to the
// clipboard; where the browser refuses, the command is selected for the person to copy.

export function CopyCommand({ command }: { command: string }) {
  const [state, setState] = useState<'idle' | 'copied' | 'selected'>('idle');
  const id = `attestation-command-${command.replace(/\W+/g, '-')}`;

  async function copy() {
    setState(await copyLink(command, navigator.clipboard, () => {
      const code = document.getElementById(id);
      const range = document.createRange();
      if (code) range.selectNodeContents(code);
      window.getSelection()?.removeAllRanges();
      window.getSelection()?.addRange(range);
    }));
  }

  return (
    <span className="attestation-cmd">
      <code id={id}>{command}</code>
      <button type="button" className="ask-button quiet attestation-copy" onClick={() => void copy()}>Copy</button>
      {state === 'copied' && <span className="ask-hint" role="status">Copied.</span>}
      {state === 'selected' && <span className="ask-hint" role="status">Selected: copy it with Ctrl+C, or ⌘C on a Mac.</span>}
    </span>
  );
}
