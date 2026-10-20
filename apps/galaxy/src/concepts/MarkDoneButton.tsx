'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CONCEPT_DONE_ROUTE, refusalWords } from './done-route';

// Mark done, or Reopen, in a concept page's header (PRD 2213, s3), as the signed-in person: it posts to the
// done route (./done.ts), which closes or reopens the concept's issue as the Omni app, then re-renders the
// page, which reads the new state. A refusal shows the route's own words in one line, and nothing changes.

export function MarkDoneButton({ concept, mode }: { concept: string; mode: 'mark' | 'reopen' }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const reopen = mode === 'reopen';
  const failed = reopen ? 'reopened' : 'marked done';

  async function press() {
    if (busy) return;
    setBusy(true);
    setProblem(null);
    try {
      const answer = await fetch(CONCEPT_DONE_ROUTE, {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ concept, done: !reopen }),
      });
      if (answer.ok) {
        router.refresh();
      } else {
        setProblem(await refusalWords(answer, `The concept was not ${failed} (${answer.status}). Try again.`));
      }
    } catch {
      setProblem(`The concept was not ${failed}. Check your connection and try again.`);
    }
    setBusy(false);
  }

  return (
    <span className="dossier-approve">
      <button type="button" className="ask-button dossier-approve-button" disabled={busy} onClick={() => void press()}>
        {busy ? (reopen ? 'Reopening…' : 'Marking…') : reopen ? 'Reopen' : 'Mark done'}
      </button>
      {problem && <span className="ask-problem" role="alert">{problem}</span>}
    </span>
  );
}
