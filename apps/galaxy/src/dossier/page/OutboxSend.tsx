'use client';
import { useEffect, useRef, useState } from 'react';
import { defined } from 'vertuo-omni-plan/kit/lib/narrow.ts';
import { copyLink } from '../../ask/page/share';
import { sentView, UNCOUNTED, type SentView } from '../../outbox/sent';
import { droppedWords, KEPT, readSending, returned, sendingKey } from '../../outbox/sending';
import type { Face } from '../../people/face';
import { LoginChip } from './LoginChip';
import { answers, type Pickable, type Picks } from './outbox-picks';
import { readAnswerOf, startAnswerOf } from './outbox-send-answers';

// Ported from the send half of archive/outbox-answers-v1:apps/galaxy/src/outbox/OutboxAnswers.tsx
// (PRD 251, s11).
//
// Send n answers on the Outbox tab (PRD 251, "Send posts the reply as you"): posts the picks to
// /api/outbox/send, which checks them against a fresh read of the outbox, then goes to GitHub's
// authorisation of the omni-loop App, which sends the person back here with `?send=<id>`. The tab reads
// the send's outcome and says it: Sent as @login, the reply's link and the next step with a copy button
// — and when GitHub lists the person as someone the kit does not count, that /omni:yolo-fix will not
// read it — or why nothing was posted. A pick whose question was settled meanwhile is dropped and said;
// every failure keeps the picks.

type Props = {
  dossierId: string;
  questions: Pickable[];
  picks: Picks;
  /** How many questions the picks answer. */
  count: number;
  /** Why Send is off, or null when it may send. */
  sendOff: string | null;
  /** Drops the picks on these questions. */
  onDrop: (numbers: number[]) => void;
  /** The viewer's face: a send posts as them (PRD 652). */
  sender?: Face | null;
};

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

function CopyStep({ step }: { step: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    setCopied((await copyLink(step, navigator.clipboard, () => {})) === 'copied');
  }
  return (
    <>
      <code>{step}</code>{' '}
      <button type="button" className="ask-button quiet" onClick={() => void copy()}>
        Copy
      </button>
      {copied && <span className="ask-hint" role="status"> Copied.</span>}
    </>
  );
}

/** What became of a send, as the tab says it. */
export function SendResult({ sent, sender = null }: { sent: SentView; sender?: Face | null }) {
  if (sent.state === 'failed') return <p className="ask-problem outbox-sent" role="alert">{sent.error} {KEPT}</p>;
  if (sent.state === 'waiting') {
    return <p className="ask-problem outbox-sent" role="alert">GitHub did not send you back with an answer, so nothing was posted. {KEPT}</p>;
  }
  return (
    <div className="outbox-sent" role="status">
      <p>
        <b>Sent as <LoginChip login={sent.login} face={sender} /></b> ·{' '}
        <a href={sent.url} target="_blank" rel="noopener noreferrer">the reply on the pull request</a>
      </p>
      <p>Next, in the terminal: <CopyStep step={sent.next} /></p>
      {!sent.counted && <p className="ask-problem" role="alert">{UNCOUNTED(sent.login)} Someone who is should answer.</p>}
    </div>
  );
}

type State =
  | { state: 'idle' }
  | { state: 'sending' }
  | { state: 'refused'; error: string }
  | { state: 'dropped'; numbers: number[]; authorize: string }
  | { state: 'result'; sent: SentView };

export function OutboxSend({ dossierId, questions, picks, count, sendOff, onDrop, sender = null }: Props) {
  const [state, setState] = useState<State>({ state: 'idle' });
  const key = sendingKey(dossierId);
  // The latest onDrop, read by the arrival effect below without making it run again on each pick.
  const drop = useRef(onDrop);
  drop.current = onDrop;

  // Back from GitHub: read what became of the send. A posted one drops the picks it answered.
  useEffect(() => {
    const back = returned(window.location.search);
    if (!back) return;
    if ('error' in back) {
      setState({ state: 'result', sent: defined(sentView(null, null, back.error), 'the failed send\'s view') });
      return;
    }
    const left = new AbortController();
    void (async () => {
      try {
        const response = await fetch(`/api/outbox/send?id=${encodeURIComponent(back.send)}`, { cache: 'no-store' });
        const sent = readAnswerOf(await response.json().catch(() => null));
        if (left.signal.aborted) return;
        if (!response.ok || !sent || !('state' in sent)) {
          setState({ state: 'refused', error: `${(sent && 'error' in sent && sent.error) || 'What became of your answers could not be read.'} ${KEPT}` });
          return;
        }
        if (sent.state === 'posted') {
          let kept: string | null = null;
          try {
            kept = window.sessionStorage.getItem(key);
            window.sessionStorage.removeItem(key);
          } catch {
            // No storage here: the picks stay, and the answers show as pending beside them.
          }
          const sending = readSending(kept, back.send);
          if (sending) drop.current(sending.numbers);
        }
        setState({ state: 'result', sent });
      } catch {
        if (!left.signal.aborted) setState({ state: 'refused', error: `The page could not be reached. ${KEPT}` });
      }
    })();
    return () => {
      left.abort();
    };
    // Once, on arrival: onDrop changes with every pick, so it is read through its ref.
  }, [key]);

  function go(send: string, numbers: number[], authorize: string) {
    try {
      window.sessionStorage.setItem(key, JSON.stringify({ send, numbers }));
    } catch {
      // As above.
    }
    window.location.assign(authorize);
  }

  async function send() {
    setState({ state: 'sending' });
    const given = answers(questions, picks);
    try {
      const response = await fetch('/api/outbox/send', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ dossier: dossierId, picks: given }),
      });
      const body = startAnswerOf(await response.json().catch(() => null));
      const dropped = body.dropped ?? [];
      if (dropped.length > 0) onDrop(dropped);
      if (!response.ok || !body.authorize || !body.send) {
        setState({ state: 'refused', error: `${body.error ?? `The page could not send (${response.status}).`} ${KEPT}` });
        return;
      }
      const numbers = given.map((a) => a.number).filter((n) => !dropped.includes(n));
      if (dropped.length > 0) {
        setState({ state: 'dropped', numbers: dropped, authorize: body.authorize });
        try {
          window.sessionStorage.setItem(key, JSON.stringify({ send: body.send, numbers }));
        } catch {
          // As above.
        }
      } else {
        go(body.send, numbers, body.authorize);
      }
    } catch {
      setState({ state: 'refused', error: `The page could not be reached. ${KEPT}` });
    }
  }

  return (
    <>
      <button type="button" className="ask-button" disabled={sendOff !== null || count === 0 || state.state === 'sending'} onClick={() => void send()}>
        Send {plural(count, 'answer')}
      </button>
      {sendOff && <span className="ask-hint">{sendOff}</span>}
      {state.state === 'sending' && <span className="ask-hint" role="status">Sending…</span>}
      {state.state === 'refused' && <p className="ask-problem outbox-sent" role="alert">{state.error}</p>}
      {state.state === 'dropped' && (
        <p className="outbox-sent" role="status">
          {droppedWords(state.numbers)} <a className="ask-button" href={state.authorize}>Send the rest through GitHub</a>
        </p>
      )}
      {state.state === 'result' && <SendResult sent={state.sent} sender={sender} />}
    </>
  );
}
