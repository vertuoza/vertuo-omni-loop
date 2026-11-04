'use client';
import { useEffect, useRef, useState } from 'react';
import { copyLink } from '../../ask/page/share';

// Ask to amend this law, on a red business law finding (PRD 2632 s4): it copies `/omni:knowledge-add amend <id>`,
// for an agent to draft the amendment on a knowledge branch and open the pull request the law's owner
// approves. Where the browser refuses the clipboard, the line shows selected for the person to copy.

/** The line an agent runs to amend law `id`. */
export const amendLine = (id: string) => `/omni:knowledge-add amend ${id}`;

export function AmendLaw({ id }: { id: string }) {
  const [said, setSaid] = useState<'copied' | 'selected' | null>(null);
  const line = useRef<HTMLElement>(null);

  // Where the clipboard refused, the line shows once rendered, then is selected.
  useEffect(() => {
    if (said !== 'selected' || line.current === null) return;
    const range = document.createRange();
    range.selectNodeContents(line.current);
    window.getSelection()?.removeAllRanges();
    window.getSelection()?.addRange(range);
  }, [said]);

  async function copy() {
    setSaid(await copyLink(amendLine(id), navigator.clipboard, () => {}));
  }

  return (
    <span className="dossier-laws-amend">
      <button type="button" className="ask-button" onClick={() => void copy()}>Ask to amend this law</button>
      {said !== null && <code ref={line}>{amendLine(id)}</code>}
      {said === 'copied' && <span className="ask-hint" role="status">Copied: paste it to your agent.</span>}
      {said === 'selected' && <span className="ask-hint" role="status">Selected: copy it with your keyboard.</span>}
    </span>
  );
}
