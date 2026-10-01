'use client';
import { useState } from 'react';
import { COPY_WORDS, copyCommand } from './StageHeaderCopy';

// Pitch (PRD 859): a shipped or retro PRD's one button. It opens a small panel with two choices,
// Customers (selected first) and Inside, the command for the one chosen, `/omni:pitch <n> --for
// <audience>`, with Copy, and one line saying where to run it. The pitch is made on the person's
// computer; the page only hands over the command. In the demo the panel opens, disabled.

export type PitchAudience = 'customers' | 'inside';

const AUDIENCES: readonly { id: PitchAudience; label: string }[] = [
  { id: 'customers', label: 'Customers' },
  { id: 'inside', label: 'Inside' },
];

export const PITCH_HINT = 'Run it in Claude Code, in this repository. The pitch shows on the Pitch tab.';

/** `/omni:pitch 859 --for customers`. */
export const pitchCommand = (prd: number, audience: PitchAudience) => `/omni:pitch ${prd} --for ${audience}`;

type Copied = 'idle' | 'copied' | 'refused';

/** The panel as drawn for one choice: the radios, the command, Copy and its outcome, the one line. */
export function PitchPanel({ prd, audience, disabled, copied, onChoose, onCopy }: {
  prd: number; audience: PitchAudience; disabled: boolean; copied: Copied;
  onChoose: (audience: PitchAudience) => void; onCopy: () => void;
}) {
  const command = pitchCommand(prd, audience);
  return (
    <div className="pitch-panel" role="group" aria-label="Pitch">
      <fieldset className="pitch-choices" disabled={disabled}>
        <legend className="ask-hint">Pitch for</legend>
        {AUDIENCES.map(({ id, label }) => (
          <label key={id} className="pitch-choice">
            <input type="radio" name={`pitch-audience-${prd}`} value={id} checked={audience === id} onChange={() => onChoose(id)} />
            {label}
          </label>
        ))}
      </fieldset>
      <span className="stage-copy">
        <code className="stage-command pitch-command">{command}</code>
        <button type="button" className="ask-button" disabled={disabled} title={command} onClick={onCopy}>Copy</button>
        {copied !== 'idle' && <span className="ask-hint" role="status">{COPY_WORDS[copied]}</span>}
      </span>
      <p className="ask-hint pitch-hint">{PITCH_HINT}</p>
      {disabled && <p className="ask-hint pitch-hint">The demo cannot make a pitch.</p>}
    </div>
  );
}

export function PitchAction({ prd, disabled }: { prd: number; disabled: boolean }) {
  const [open, setOpen] = useState(false);
  const [audience, setAudience] = useState<PitchAudience>('customers');
  const [copied, setCopied] = useState<Copied>('idle');

  function choose(next: PitchAudience) {
    setAudience(next);
    setCopied('idle');
  }

  async function copy() {
    if (disabled) return;
    setCopied(await copyCommand(pitchCommand(prd, audience), navigator.clipboard));
  }

  return (
    <span className="pitch-action" data-demo={disabled ? 'true' : undefined}>
      <button type="button" className="ask-button stage-action" aria-expanded={open} onClick={() => setOpen(!open)}>Pitch</button>
      {open && <PitchPanel prd={prd} audience={audience} disabled={disabled} copied={copied} onChoose={choose} onCopy={copy} />}
    </span>
  );
}
