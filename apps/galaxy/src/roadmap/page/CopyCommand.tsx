'use client';
import { useState } from 'react';
import { copyLink } from '../../ask/page/share';

// A prerequisite card's command (PRD 1218, s6) in a code box with a Copy button: the button puts the
// command on the clipboard and says so; where the browser refuses, it selects the command for the person
// to copy by hand.

export function CopyCommand({ command, id }: { command: string; id: string }) {
  const [said, setSaid] = useState<'copied' | 'selected' | null>(null);

  function select() {
    const code = document.getElementById(id);
    if (code === null) return;
    const range = document.createRange();
    range.selectNodeContents(code);
    window.getSelection()?.removeAllRanges();
    window.getSelection()?.addRange(range);
  }

  async function copy() {
    setSaid(await copyLink(command, navigator.clipboard, select));
  }

  return (
    <div className="roadmap-command">
      <code id={id}>{command}</code>
      <button type="button" className="ask-button quiet" onClick={() => void copy()}>Copy</button>
      {said === 'copied' ? <span className="ask-hint" role="status">Copied.</span> : null}
      {said === 'selected' ? <span className="ask-hint" role="status">Selected: copy it with your keyboard.</span> : null}
    </div>
  );
}
