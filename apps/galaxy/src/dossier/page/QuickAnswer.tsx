'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import { answerQuick, type QuickOutcome } from './source';
import type { QuickRound } from './view';

// A quick round answered on the list (PRD 384, part 4), for a person the server said may answer it: a
// button per option. One click sends that option through the question page's own path, as the
// signed-in person, so the database's rule still refuses anyone else. Answered, the page renders again
// in place (router.refresh()): the round shows as answered, and the page scrolls to the next open
// round. Someone first: "Already answered by …"; moved to the terminal meanwhile: it renders as moved. A failed send says so and keeps the buttons. Rendered
// on the server too, with its buttons off until the script runs: with no script, the round's Open link
// is the way to answer it.

type Props = {
  supabase: { url: string; key: string };
  roundId: string;
  quick: QuickRound;
};

type Sent = { kind: 'idle' } | { kind: 'sending' } | { kind: 'failed' } | QuickOutcome;

/** What the round says once the click came second: who came first, or that it moved. */
export function takenLine(outcome: Extract<QuickOutcome, { kind: 'taken' }>, names: Record<string, string>): string {
  if (outcome.moved) return 'This question moved to the terminal before your answer.';
  if (outcome.by === null) return outcome.via === 'terminal' ? 'Already answered in the terminal.' : 'Already answered.';
  return `Already answered by ${names[outcome.by] ?? 'someone who left the workspace'}`;
}

export function QuickAnswer({ supabase, roundId, quick }: Props) {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [sent, setSent] = useState<Sent>({ kind: 'idle' });
  useEffect(() => setReady(true), []);

  async function answer(value: string) {
    setSent({ kind: 'sending' });
    try {
      const outcome = await answerQuick(createBrowserClient(supabase.url, supabase.key), roundId, quick.question, value);
      setSent(outcome);
      // Answered or moved: render the round as it now is. Answered first by someone: keep saying who
      // until the change check re-renders the page, which it does, the answered count having moved.
      if (outcome.kind === 'answered' || outcome.moved) router.refresh();
      if (outcome.kind === 'answered' && quick.next) {
        document.getElementById(quick.next)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    } catch {
      setSent({ kind: 'failed' });
    }
  }

  if (sent.kind === 'answered') return <p className="dossier-quick-note" role="status">Answer sent.</p>;
  if (sent.kind === 'taken') return <p className="dossier-quick-note" role="status">{takenLine(sent, quick.names)}</p>;
  const busy = !ready || sent.kind === 'sending';
  return (
    <div className="dossier-quick">
      <ul className="dossier-quick-choices" aria-label="Answer with one click">
        {quick.choices.map((choice) => (
          <li key={choice.value}>
            <button type="button" className="dossier-quick-choice" disabled={busy} onClick={() => void answer(choice.value)}>
              <span className="dossier-option-label">
                {choice.label}
                {choice.recommended && <span className="ask-rec">Recommended</span>}
              </span>
              {choice.description && <span className="dossier-option-desc">{choice.description}</span>}
            </button>
          </li>
        ))}
      </ul>
      {sent.kind === 'failed' && (
        <p className="ask-problem" role="alert">Your answer did not go through. Check your connection and try again.</p>
      )}
    </div>
  );
}
