'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { emptyDraft, roundAnswers, type Draft } from '../answer-model';
import type { Category } from '../classify';
import { backAfterSend, noRounds } from './back';
import { askClient, AskSignedOut } from '../ask.client';
import { questionWrites } from './writes';
import { SignInCard } from './SignInCard';
import { questionCallbackPath } from './sign-in';
import { CategoryChip } from './CategoryChip';
import { ContextLine } from './ContextLine';
import { demoQuestionPort } from './demo';
import { AnswerList, History } from './History';
import { LeadMessage } from './LeadMessage';
import { PersonChip } from '../../people/PersonChip';
import { useWaiting } from '../../waiting/WaitingProvider';
import { titled } from '../../waiting/waiting';
import { CANNOT_REACH, poll, readTick } from './poll';
import { answeredTitle, questionView, type Member, type QuestionState } from './question';
import { RoundForm } from './RoundForm';
import type { QuestionPort } from './source';
import { askTitle } from './tabs';
import { categoryChip, contextParts, minutesLeft, withCategory } from './view';
import { QuestionList } from './QuestionText';

// One question, at /ask/q/<round> (PRD 144): the link a session's owner shares. While it is open, the
// owner and the member it is shared with answer it here, with the session's earlier rounds below for
// context and the time left before the question moves to the terminal; any other member reads it.
// Once answered, whoever comes second reads who answered first, with the answer. Read again every 2 s
// while the tab is visible, until it is answered, moved or closed. Once this person's answer is read
// back, the page goes back where it came from (PRD 384, src/ask/page/back.ts): the PRD page it was
// opened from, at its next open round, or the session's ask page. It reads through
// GET /api/ask/rounds/:id (src/ask/ask.client.ts, PRD 1318): signed out, the poll stops and the page
// shows the sign-in card; a failed read keeps what it last showed.

export type QuestionSource = { kind: 'database'; url: string; key: string } | { kind: 'demo' };

type Props = {
  source: QuestionSource; initial: QuestionState; serverNow: number; me: string | null; members: Member[];
  /** The dossier the page was opened from (`?from=`), as given: back.ts ignores anything that is no dossier id. */
  from?: string | null | undefined;
};

function makePort(source: QuestionSource, seed: QuestionState): QuestionPort {
  if (source.kind === 'demo') return demoQuestionPort(seed);
  const client = askClient();
  return { read: () => client.round(seed.round.id), ...questionWrites(client) };
}

const roundsOf = (source: QuestionSource) => (source.kind === 'demo' ? noRounds : (dossierId: string) => askClient().dossierRounds(dossierId));

export function AskQuestion({ source, initial, serverNow, me, members, from = null }: Props) {
  const [state, setState] = useState(initial);
  const [offset] = useState(() => serverNow - Date.now());
  const [now, setNow] = useState(serverNow);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [sending, setSending] = useState(false);
  const [sorting, setSorting] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [signedOut, setSignedOut] = useState(false);
  const port = useRef<QuestionPort | null>(null);
  const getPort = useCallback(() => (port.current ??= makePort(source, initial)), [source, initial]);
  const clock = useCallback(() => Date.now() + offset, [offset]);

  const total = useWaiting().counts.total;
  const view = useMemo(() => questionView(state, me, members, now), [state, me, members, now]);
  const live = view.kind === 'open';

  useEffect(() => {
    document.title = titled(askTitle(view.kind === 'open' && view.canAnswer), total);
  }, [view, total]);

  useEffect(() => {
    if (!live || signedOut) return;
    return poll(readTick({
      read: () => getPort().read(),
      gone: () => {
        window.location.reload();
      },
      seen: (next) => {
        const at = clock();
        setState(next);
        setNow(at);
        setProblem(null);
        return questionView(next, me, members, at).kind === 'open';
      },
      failed: () => {
        setNow(clock());
        setProblem(CANNOT_REACH);
      },
      signedOut: () => {
        setSignedOut(true);
      },
    }), document);
  }, [live, signedOut, getPort, clock, me, members]);

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
      const at = clock();
      if (next) setState(next);
      setNow(at);
      const target = next && await backAfterSend({
        view: questionView(next, me, members, at), from, sessionId: next.session.id, roundId: next.round.id, readRounds: roundsOf(source),
      });
      if (target) window.location.assign(target);
    } catch (error) {
      if (error instanceof AskSignedOut) setSignedOut(true);
      else setProblem('Your answer did not go through. Check your connection and send it again.');
    } finally {
      setSending(false);
    }
  }, [answers, sending, getPort, state.round.id, clock, me, members, from, source]);
  // What RoundForm calls, stable while onSend is: its keyboard effect runs on the same changes as before.
  const send = useCallback(() => {
    void onSend();
  }, [onSend]);

  const onSort = useCallback(async (category: Category | null) => {
    setSorting(true);
    setProblem(null);
    try {
      const set = await getPort().sort(state.round.id, category);
      if (set) setState((s) => ({ ...s, round: withCategory({ session: s.session, rounds: [s.round] }, s.round.id, set).rounds[0] ?? s.round }));
      else setProblem('This question could not be sorted: it is no longer in your workspace.');
    } catch (error) {
      if (error instanceof AskSignedOut) setSignedOut(true);
      else setProblem('The category was not saved. Check your connection and try again.');
    } finally {
      setSorting(false);
    }
  }, [getPort, state.round.id]);

  if (signedOut && source.kind === 'database') return <SignInCard supabase={source} returnPath={questionCallbackPath(state.round.id)} />;

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
      {view.kind !== 'closed' && <LeadMessage key={state.round.id} lead={state.round.lead} />}

      {view.kind === 'open' && view.canAnswer && current && (
        <RoundForm
          roundId={state.round.id}
          questions={view.questions}
          draft={current}
          onDraft={setDraft}
          canSend={answers !== null}
          sending={sending}
          onSend={send}
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
          <QuestionList questions={view.questions} />
        </section>
      )}

      {view.kind === 'answered' && (
        <section className="ask-card" aria-live="polite">
          <h1>{view.byMe ? answeredTitle(view) : <>Already answered by <PersonChip person={{ name: view.by, face: view.byFace }} size="inline" /></>}</h1>
          <p className="ask-muted">{view.via === 'terminal' ? 'Answered in the terminal.' : 'Answered on the page.'}</p>
          <AnswerList lines={view.lines} className="ask-answered" />
        </section>
      )}

      {view.kind === 'moved' && (
        <section className="ask-card" aria-live="polite">
          <h1>Moved to the terminal</h1>
          <p className="ask-muted">Nobody answered it on the page in time, so Claude asks it in the terminal instead.</p>
          <QuestionList questions={view.questions} />
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
