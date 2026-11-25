'use client';
import { Button } from '@omni/ui';
import { useRouter } from 'next/navigation';
import { useState, type ReactNode } from 'react';
import type { Finding } from '../api/supervisor.contract';
import { dismissFinding, pressSuggestion } from './proposals.client';
import { choicesOf, pressedWords } from './choices';
import './Suggested.css';

// The Suggested box of an open finding, for an owner (PRD omni-loop-34 s7, the before/after page's 2.A): the
// Supervisor's suggestions as buttons, the first the primary one, a link for Open Terminal or Open the mission, and Not a
// problem on the right. A press goes through POST /api/supervisor/proposals as that owner, which carries it out through
// today's route and posts the result in the finding's thread; the box says how it ended, copies the steps a runner
// needs when the press answered some, and the page reads itself again. A member never gets the box (AC-11).

export function Suggested({ workspace, finding }: { workspace: string; finding: Finding }): ReactNode {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [said, setSaid] = useState<{ words: string; error: boolean } | null>(null);
  const choices = choicesOf(finding);

  async function press(id: string) {
    setBusy(true);
    setSaid(null);
    const pressed = await pressSuggestion(workspace, id);
    setBusy(false);
    if (!pressed.ok) {
      setSaid({ words: pressed.error, error: true });
      return;
    }
    if (pressed.value.steps !== null) await navigator.clipboard.writeText(pressed.value.steps).catch(() => undefined);
    setSaid({ words: pressedWords(pressed.value), error: pressed.value.outcome !== 'done' });
    router.refresh();
  }

  async function dismiss() {
    setBusy(true);
    setSaid(null);
    const dismissed = await dismissFinding(workspace, finding.id);
    setBusy(false);
    if (!dismissed.ok) {
      setSaid({ words: dismissed.error, error: true });
      return;
    }
    router.refresh();
  }

  return (
    <section className="sv-suggested" aria-label="Suggested">
      <b>Suggested</b>
      <div className="sv-suggestions">
        {choices.map((choice) => {
          if (choice.kind === 'link') return <Button key={choice.id} size="sm" variant="quiet" href={choice.href}>{choice.label}</Button>;
          if (choice.kind === 'pressed') return <span key={choice.id} className="sv-pressed"><b>{choice.label}</b> · {choice.words}</span>;
          return <Button key={choice.id} size="sm" variant={choice.primary ? 'primary' : 'secondary'} disabled={busy} onClick={() => void press(choice.id)}>{choice.label}</Button>;
        })}
        <span className="sv-dismiss"><Button size="sm" variant="quiet" disabled={busy} onClick={() => void dismiss()}>Not a problem</Button></span>
      </div>
      {said !== null && <p className={said.error ? 'sv-error' : 'sv-said'} role={said.error ? 'alert' : 'status'}>{said.words}</p>}
    </section>
  );
}
