'use client';
import { useState } from 'react';

// Build it (PRD 426): the inbox stage's one button copies the command that builds the PRD, and says
// "Copied". Where the browser refuses the clipboard, the command stays written beside it to copy by hand.

/** What the button says once pressed: `Copied`, or that the command must be copied by hand. */
export const COPY_WORDS = { copied: 'Copied', refused: 'Copy the command by hand.' } as const;

/** Copies `command`; `refused` when there is no clipboard or the browser says no. */
export async function copyCommand(command: string, clipboard: { writeText(text: string): Promise<void> } | undefined): Promise<'copied' | 'refused'> {
  try {
    if (!clipboard) throw new Error('no clipboard');
    await clipboard.writeText(command);
    return 'copied';
  } catch {
    return 'refused';
  }
}

export function StageHeaderCopy({ label, command }: { label: string; command: string }) {
  const [state, setState] = useState<'idle' | 'copied' | 'refused'>('idle');

  async function copy() {
    setState(await copyCommand(command, navigator.clipboard));
  }

  return (
    <span className="stage-copy">
      <button type="button" className="ask-button stage-action" onClick={copy} title={command}>{label}</button>
      <code className="stage-command">{command}</code>
      {state !== 'idle' && <span className="ask-hint" role="status">{COPY_WORDS[state]}</span>}
    </span>
  );
}
