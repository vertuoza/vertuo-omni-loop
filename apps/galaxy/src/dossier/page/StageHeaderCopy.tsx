'use client';
import { useState } from 'react';
import { SendToTerminal } from '../../runners/send/SendToTerminal';

// Build it (PRD 426): the inbox stage's one button copies the command that builds the PRD, and says
// "Copied". Where the browser refuses the clipboard, the command stays written beside it to copy by hand.
// PRD 1830 s4: Send to terminal sits beside it, when the line is one a runner runs and the page gives the
// viewer a runner to send it to (../../runners/send/SendToTerminal.tsx); otherwise nothing changes.

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
      <button type="button" className="ask-button stage-action" onClick={() => void copy()} title={command}>{label}</button>
      <code className="stage-command">{command}</code>
      <SendToTerminal line={command} />
      {state !== 'idle' && <span className="ask-hint" role="status">{COPY_WORDS[state]}</span>}
    </span>
  );
}
