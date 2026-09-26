'use client';
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { emptyDraft, roundAnswers, type Draft } from '../answer-model';
import type { Category } from '../classify';
import { CategoryChip } from './CategoryChip';
import { ContextLine } from './ContextLine';
import { demoQuestionPort } from './demo';
import { History } from './History';
import { poll } from './poll';
import { answeredTitle, questionView, type Member, type QuestionState } from './question';
import { RoundForm } from './RoundForm';
import { questionPort, type QuestionPort } from './source';
import { categoryChip, contextParts, minutesLeft, withCategory } from './view';

// One question, at /ask/q/<round> (PRD 144): the link a session's owner shares. While it is open, the
// owner and the member it is shared with answer it here, with the session's earlier rounds below for
// context and the time left before the question moves to the terminal; any other member reads it.
// Once answered, whoever comes second reads who answered first, with the answer. Read again every 2 s
// while the tab is visible, until it is answered, moved or closed.

export type QuestionSource = { kind: 'database'; url: string; key: string } | { kind: 'demo' };

type Props = { source: QuestionSource; initial: QuestionState; serverNow: number; me: string | null; members: Member[] };

function makePort(source: QuestionSource, seed: QuestionState): QuestionPort {
  return source.kind === 'demo' ? demoQuestionPort(seed) : questionPort(createBrowserClient(source.url, source.key), seed.round.id);
}

export function AskQuestion({ source, initial, serverNow, me, members }: Props) {
  const [state, setState] = useState(initial);
  const [offset] = useState(() => serverNow - Date.now());
  const [now, setNow] = useState(serverNow);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [sending, setSending] = useState(false);
  const [sorting, setSorting] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const port = useRef<QuestionPort | null>(null);
  const getPort = useCallback(() => (port.current ??= makePort(source, initial)), [source, initial]);
  const clock = useCallback(() => Date.now() + offset, [offset]);

  const view = useMemo(() => questionView(state, me, members, now), [state, me, members, now]);
  const live = view.kind === 'open';

  useEffect(() => {
    document.title = view.kind === 'open' && view.canAnswer ? '● Claude asks · OMNI LOOP' : 'Ask · OMNI LOOP';
  }, [view]);

  useEffect(() => {
    if (!live) return;
    return poll(async () => {
      try {
        const next = await getPort().read();
        if (!next) {
          window.location.reload();
          return false;
        }
        const at = clock();
        setState(next);
        setNow(at);
        setProblem(null);
        return questionView(next, me, members, at).kind === 'open';
      } catch {
        setNow(clock());
        setProblem('Cannot reach the server. Trying again every few seconds.');
        return true;
      }
    }, document);
  }, [live, getPort, clock, me, members]);

  const questions = view.kind === 'open' && view.canAnswer ? view.questions : null;
  const current = questions ? draft ?? emptyDraft(questions) : null;
  const answers = questions && current ? roundAnswers(questions, current) : null;

  const onSend = useCallback(async () => {
    if (!answers || sending) return;
    setSending(true);
    setProblem(null);
    try {
      await getPort().send(state.round.id, answers);
      // Answered, or someone came first: either way the next read says who.
      const next = await getPort().read();
      if (next) setState(next);
      setNow(clock());
    } catch {
      setProblem('Your answer did not go through. Check your connection and send it again.');
    } finally {
      setSending(false);
    }
  }, [answers, sending, getPort, state.round.id, clock]);

  const onSort = useCallback(async (category: Category | null) => {
    setSorting(true);
    setProblem(null);
    try {
      const set = await getPort().sort(state.round.id, category);
      if (set) setState((s) => ({ ...s, round: withCategory({ session: s.session, rounds: [s.round] }, s.round.id, set).rounds[0] }));
      else setProblem('This question could not be sorted: it is no longer in your workspace.');
    } catch {
      setProblem('The category was not saved. Check your connection and try again.');
    } finally {
      setSorting(false);
    }
  }, [getPort, state.round.id]);

  return (
    <div className="ask-col">
      <p className="ask-title">{state.session.title}</p>
      {problem && <p className="ask-problem" role="status">{problem}</p>}
      <ContextLine parts={contextParts(state.session, state.round)} />
      <CategoryChip
        chip={categoryChip(state.round, { me, owner: state.session.owner })}
        onChange={(category) => void onSort(category)}
        saving={sorting}
      />

      {view.kind === 'open' && view.canAnswer && current && (
        <RoundForm
          roundId={state.round.id}
          questions={view.questions}
          draft={current}
          onDraft={setDraft}
          canSend={answers !== null}
          sending={sending}
          onSend={onSend}
          minutesLeft={minutesLeft(view.movesAt, now)}
        />
      )}

      {view.kind === 'open' && !view.canAnswer && (
        <section className="ask-card" aria-live="polite">
          <h1>Waiting for an answer</h1>
          <p className="ask-muted">
            The person who opened this session, or whoever they shared it with, answers it. It moves to the terminal in{' '}
            <span suppressHydrationWarning>{minutesLeft(view.movesAt, now)} min</span>.
          </p>
          <ul className="ask-card-list">
            {view.questions.map((q, i) => <li key={i}>{q.question}</li>)}
          </ul>
        </section>
      )}

      {view.kind === 'answered' && (
        <section className="ask-card" aria-live="polite">
          <h1>{answeredTitle(view)}</h1>
          <p className="ask-muted">{view.via === 'terminal' ? 'Answered in the terminal.' : 'Answered on the page.'}</p>
          <dl className="ask-answered">
            {view.lines.map((line, i) => (
              <Fragment key={i}>
                <dt>{line.question}</dt>
                <dd>{line.answer ?? '—'}</dd>
              </Fragment>
            ))}
          </dl>
        </section>
      )}

      {view.kind === 'moved' && (
        <section className="ask-card" aria-live="polite">
          <h1>Moved to the terminal</h1>
          <p className="ask-muted">Nobody answered it on the page in time, so Claude asks it in the terminal instead.</p>
          <ul className="ask-card-list">
            {view.questions.map((q, i) => <li key={i}>{q.question}</li>)}
          </ul>
        </section>
      )}

      {view.kind === 'closed' && (
        <section className="ask-card" aria-live="polite">
          <h1>Session closed</h1>
          <p className="ask-muted">Ask mode was switched off before this question was answered.</p>
        </section>
      )}

      <History history={view.earlier} />
    </div>
  );
}
