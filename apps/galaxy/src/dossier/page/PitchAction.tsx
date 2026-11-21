'use client';
import { useState } from 'react';
import { Button, Code, Radio, Text } from '@omni/ui';
import { SendToTerminal } from '../../runners/send/SendToTerminal';
import { COPY_WORDS, copyCommand } from './StageHeaderCopy';
import type { PrdNumber } from 'omni-loop/kit/lib/ids.ts';

// Pitch (PRD 859): a shipped or retro PRD's one button. It opens a small panel with two choices,
// Customers (selected first) and Inside, the command for the one chosen, `/omni:pitch <n> --for
// <audience>`, with Copy, and one line saying where to run it. The pitch is made on the person's
// computer; the page only hands over the command. In the demo the panel opens, disabled.
// PRD 1830 s4: beside Copy, Send to terminal hands the command to a runner instead, when the page gives
// the viewer one; never in the demo.

export type PitchAudience = 'customers' | 'inside';

const AUDIENCES: readonly { id: PitchAudience; label: string }[] = [
  { id: 'customers', label: 'Customers' },
  { id: 'inside', label: 'Inside' },
];

export const PITCH_HINT = 'Run it in your coding agent, in this repository. The pitch shows on the Pitch tab.';

/** `/omni:pitch 859 --for customers`. */
export const pitchCommand = (prd: PrdNumber, audience: PitchAudience) => `/omni:pitch ${prd} --for ${audience}`;

type Copied = 'idle' | 'copied' | 'refused';

/** The panel as drawn for one choice: the radios, the command, Copy and its outcome, the one line. */
export function PitchPanel({ prd, audience, disabled, copied, onChoose, onCopy }: {
  prd: PrdNumber; audience: PitchAudience; disabled: boolean; copied: Copied;
  onChoose: (audience: PitchAudience) => void; onCopy: () => void;
}) {
  const command = pitchCommand(prd, audience);
  return (
    <div className="pitch-panel" role="group" aria-label="Pitch">
      <Radio
        label="Pitch for"
        name={`pitch-audience-${prd}`}
        orientation="horizontal"
        disabled={disabled}
        value={audience}
        options={AUDIENCES.map(({ id, label }) => ({ value: id, label }))}
        onChange={(event) => { onChoose(event.currentTarget.value === 'inside' ? 'inside' : 'customers'); }}
      />
      <span className="stage-copy">
        <Code>{command}</Code>
        <Button disabled={disabled} title={command} onClick={onCopy}>Copy</Button>
        {copied !== 'idle' && <span role="status"><Text as="span" size="small" tone="secondary">{COPY_WORDS[copied]}</Text></span>}
        {!disabled && <SendToTerminal line={command} />}
      </span>
      <Text size="small" tone="secondary">{PITCH_HINT}</Text>
      {disabled && <Text size="small" tone="secondary">The demo cannot make a pitch.</Text>}
    </div>
  );
}

export function PitchAction({ prd, disabled }: { prd: PrdNumber; disabled: boolean }) {
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
    <span className="pitch-anchor" data-demo={disabled ? 'true' : undefined}>
      <Button variant="primary" expanded={open} onClick={() => { setOpen(!open); }}>Pitch</Button>
      {open && <PitchPanel prd={prd} audience={audience} disabled={disabled} copied={copied} onChoose={choose} onCopy={() => void copy()} />}
    </span>
  );
}
