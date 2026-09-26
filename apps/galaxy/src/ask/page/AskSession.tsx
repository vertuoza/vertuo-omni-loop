'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { emptyDraft, roundAnswers, type Draft } from '../answer-model';
import { demoPort } from './demo';
import { History } from './History';
import { poll } from './poll';
import { RoundForm } from './RoundForm';
import { databasePort, type AskPort } from './source';
import { keepSent, minutesLeft, pageTitle, sessionView, withPageAnswer, type Sent, type SessionState } from './view';

// One ask session, for its signed-in owner: the open round at the top (or Claude is working,
// moved to the terminal, session closed), the history below, read again every 2 s while the tab
// is visible. The server rendered the first state; this keeps it current and sends the answers.

export type SourceConfig = { kind: 'database'; url: string; key: string } | { kind: 'demo' };

type Props = { source: SourceConfig; initial: SessionState; serverNow: number };

function makePort(source: SourceConfig, seed: SessionState): AskPort {
  if (source.kind === 'demo') return demoPort(seed);
  return databasePort(createBrowserClient(source.url, source.key), seed);
}

export function AskSession({ source, initial, serverNow }: Props) {
  const [state, setState] = useState(initial);
  // The server's clock, as the page counts it (a round moves to the terminal on the hook's clock).
  const [offset] = useState(() => serverNow - Date.now());
  const [now, setNow] = useState(serverNow);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [sending, setSending] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const port = useRef<AskPort | null>(null);
  const sent = useRef<Sent>(new Map());
  const getPort = useCallback(() => (port.current ??= makePort(source, initial)), [source, initial]);
  const clock = useCallback(() => Date.now() + offset, [offset]);

  const view = useMemo(() => sessionView(state, now), [state, now]);
  const closed = view.kind === 'closed';

  useEffect(() => {
    document.title = pageTitle(view);
  }, [view]);

  useEffect(() => {
    if (closed) return;
    return poll(async () => {
      try {
        const next = await getPort().read();
        // Gone, or no longer this person's (signed out elsewhere): the server says which.
        if (!next) {
          window.location.reload();
          return false;
        }
        const at = clock();
        setState(keepSent(next, sent.current));
        setNow(at);
        setProblem(null);
        return sessionView(next, at).kind !== 'closed';
      } catch {
        setNow(clock());
        setProblem('Cannot reach the server. Trying again every few seconds.');
        return true;
      }
    }, document);
  }, [closed, getPort, clock]);

  const round = view.kind === 'open' ? view.round : null;
  const questions = view.kind === 'open' ? view.questions : null;
  const draft = round && questions ? drafts[round.id] ?? emptyDraft(questions) : null;
  const answers = questions && draft ? roundAnswers(questions, draft) : null;

  const onDraft = useCallback((next: Draft) => {
    if (round) setDrafts((all) => ({ ...all, [round.id]: next }));
  }, [round]);

  const onSend = useCallback(async () => {
    if (!round || !answers || sending) return;
    setSending(true);
    setProblem(null);
    setNotice(null);
    try {
      const outcome = await getPort().send(round.id, answers);
      if (outcome === 'answered') {
        const at = clock();
        sent.current.set(round.id, { answers, at });
        setState((s) => withPageAnswer(s, round.id, answers, at));
      } else {
        setNotice('This question was already answered, or it moved to the terminal. Answer it there.');
        const next = await getPort().read();
        if (next) setState(next);
      }
      setNow(clock());
    } catch {
      setProblem('Your answer did not go through. Check your connection and send it again.');
    } finally {
      setSending(false);
    }
  }, [round, answers, sending, getPort, clock]);

  return (
    <div className="ask-col">
      <p className="ask-title">{state.session.title}</p>
      {problem && <p className="ask-problem" role="status">{problem}</p>}
      {notice && <p className="ask-problem" role="status">{notice}</p>}

      {view.kind === 'open' && draft && (
        <RoundForm
          roundId={view.round.id}
          questions={view.questions}
          draft={draft}
          onDraft={onDraft}
          canSend={answers !== null}
          sending={sending}
          onSend={onSend}
          minutesLeft={minutesLeft(view.movesAt, now)}
        />
      )}

      {view.kind === 'working' && (
        <section className="ask-card" aria-live="polite">
          <h1 className="ask-working">Claude is working</h1>
          <p className="ask-muted">
            {state.rounds.length === 0
              ? 'No questions yet. The first one shows here as soon as Claude asks.'
              : 'The next question shows here as soon as Claude asks. Keep this tab open.'}
          </p>
        </section>
      )}

      {view.kind === 'moved' && (
        <section className="ask-card" aria-live="polite">
          <h1>Moved to the terminal</h1>
          <p className="ask-muted">
            The page did not answer in time, so Claude asks this in the terminal instead. Answer it there, and the
            answer shows below.
          </p>
          {view.questions.length > 0 && (
            <ul className="ask-card-list">
              {view.questions.map((q, i) => <li key={i}>{q.question}</li>)}
            </ul>
          )}
        </section>
      )}

      {view.kind === 'closed' && (
        <section className="ask-card" aria-live="polite">
          <h1>Session closed</h1>
          <p className="ask-muted">
            Ask mode was switched off, or this session sat idle for 12 hours. Run <code>/omni:ask on</code> for a new
            link.
          </p>
        </section>
      )}

      <History history={view.history} />
    </div>
  );
}
