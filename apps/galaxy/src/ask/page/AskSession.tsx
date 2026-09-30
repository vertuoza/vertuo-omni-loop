'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { emptyDraft, roundAnswers, type Draft } from '../answer-model';
import type { Category } from '../classify';
import { CategoryChip } from './CategoryChip';
import { ContextLine } from './ContextLine';
import { demoPort } from './demo';
import { History } from './History';
import { LeadMessage } from './LeadMessage';
import { poll } from './poll';
import type { Member } from './question';
import { shareCandidates } from './share';
import { ShareButton } from './ShareButton';
import { RoundForm } from './RoundForm';
import { databasePort, type AskPort } from './source';
import { QuestionList } from './QuestionText';
import {
  categoryChip, contextParts, keepSent, minutesLeft, sessionView, tabWorking, withCategory, withPageAnswer, type RoundRow, type Sent, type SessionState,
} from './view';
import { PlayDock } from '../../play-dock/PlayDock';
import type { AskDock } from './dock-player';

// One ask session: the open round at the top (or Claude is working, moved to the terminal, session
// closed), the history below, read again every 2 s while the tab is visible. The server rendered the
// first state; this keeps it current. Its owner answers and may delete the session; any other member
// of its workspace (PRD 144) reads it all, with no answer form and no delete. Every round carries its
// category chip, which the owner and any other member may change. While a round is open, its owner may
// share it with another member of the workspace (PRD 144), who answers it at /ask/q/<round>.
// A tab of the person's own (`dock` given) also offers the play dock beside "Claude is working" (PRD
// 757) while its terminal's heartbeat says it works, pausing on the open question and leading to it.

/** Where the dock's ⏸ CLAUDE ASKED · ANSWER leads: the top of the open question, on this page. */
const QUESTION_ANCHOR = 'ask-question';

export type SourceConfig = { kind: 'database'; url: string; key: string } | { kind: 'demo' };

/** Who is looking: the session's owner, or another member of its workspace, who only reads. */
export type Viewer = 'owner' | 'member';

/** `me`: the signed-in account's id, so the chip can say "set by you". `members`: the session's
 * workspace, whom its owner may share an open round with. `onState` hears every state the pane
 * shows, so the tab list can show the selected tab as fresh as its pane. The browser title is the
 * tab list's (AskPage). */
type Props = {
  source: SourceConfig;
  initial: SessionState;
  serverNow: number;
  viewer: Viewer;
  me?: string | null;
  members?: Member[];
  onState?: (state: SessionState) => void;
  /** Who plays in the play dock, and where the score goes: none, no dock (a teammate's session). */
  dock?: AskDock | null;
};

function makePort(source: SourceConfig, seed: SessionState): AskPort {
  if (source.kind === 'demo') return demoPort(seed);
  return databasePort(createBrowserClient(source.url, source.key), seed);
}

export function AskSession({ source, initial, serverNow, viewer, me = null, members = [], onState, dock = null }: Props) {
  const owner = viewer === 'owner';
  const [state, setState] = useState(initial);
  // The server's clock, as the page counts it (a round moves to the terminal on the hook's clock).
  const [offset] = useState(() => serverNow - Date.now());
  const [now, setNow] = useState(serverNow);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [sending, setSending] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleted, setDeleted] = useState(false);
  const [sorting, setSorting] = useState<string | null>(null);
  const port = useRef<AskPort | null>(null);
  const sent = useRef<Sent>(new Map());
  const getPort = useCallback(() => (port.current ??= makePort(source, initial)), [source, initial]);
  const clock = useCallback(() => Date.now() + offset, [offset]);

  const view = useMemo(() => sessionView(state, now), [state, now]);
  const closed = view.kind === 'closed' || deleted;

  useEffect(() => {
    onState?.(state);
  }, [state, onState]);

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

  const round = owner && view.kind === 'open' ? view.round : null;
  const questions = owner && view.kind === 'open' ? view.questions : null;
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

  const onDelete = useCallback(async () => {
    if (deleting || !window.confirm('Delete this session and every question in it, for good?')) return;
    setDeleting(true);
    setProblem(null);
    try {
      if (await getPort().remove()) setDeleted(true);
      else setProblem('This session could not be deleted: only the person who opened it can.');
    } catch {
      setProblem('The session was not deleted. Check your connection and try again.');
    } finally {
      setDeleting(false);
    }
  }, [deleting, getPort]);

  const onSort = useCallback(async (roundId: string, category: Category | null) => {
    setSorting(roundId);
    setProblem(null);
    try {
      const set = await getPort().sort(roundId, category);
      if (set) setState((s) => withCategory(s, roundId, set));
      else setProblem('This question could not be sorted: it is no longer in your workspace.');
    } catch {
      setProblem('The category was not saved. Check your connection and try again.');
    } finally {
      setSorting(null);
    }
  }, [getPort]);

  const chip = (round: Pick<RoundRow, 'id' | 'category' | 'category_by'>) => (
    <CategoryChip
      chip={categoryChip(round, { me, owner: state.session.owner })}
      onChange={(category) => void onSort(round.id, category)}
      saving={sorting === round.id}
    />
  );

  if (deleted) {
    return (
      <div className="ask-col">
        <section className="ask-card" aria-live="polite">
          <h1>Session deleted</h1>
          <p className="ask-muted">This session and its questions are gone for good.</p>
        </section>
      </div>
    );
  }

  return (
    <div className="ask-col">
      <p className="ask-title" id={dock ? QUESTION_ANCHOR : undefined}>{state.session.title}</p>
      {problem && <p className="ask-problem" role="status">{problem}</p>}
      {notice && <p className="ask-problem" role="status">{notice}</p>}

      {(view.kind === 'open' || view.kind === 'moved') && (
        <>
          <ContextLine parts={contextParts(state.session, view.round)} />
          {chip(view.round)}
          <LeadMessage key={view.round.id} lead={view.round.lead} />
        </>
      )}

      {view.kind === 'open' && !owner && (
        <section className="ask-card" aria-live="polite">
          <h1>Waiting for the owner&apos;s answer</h1>
          <p className="ask-muted">Only the person who opened this session answers it. The answer shows below once given.</p>
          <QuestionList questions={view.questions} />
        </section>
      )}

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

      {view.kind === 'open' && owner && (
        <ShareButton
          key={view.round.id}
          roundId={view.round.id}
          candidates={shareCandidates(members, state.session.owner)}
          onShare={(member) => getPort().share(view.round.id, member)}
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
            {owner
              ? 'The page did not answer in time, so Claude asks this in the terminal instead. Answer it there, and the answer shows below.'
              : 'The page did not get an answer in time, so Claude asks this in the terminal instead. The answer shows below once given.'}
          </p>
          {view.questions.length > 0 && (
            <QuestionList questions={view.questions} />
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

      <History history={view.history} chip={(entry) => chip({ id: entry.id, category: entry.category, category_by: entry.category_by })} />

      {dock && (
        <PlayDock
          state={tabWorking(state, now)}
          player={dock.player}
          hero={dock.hero}
          team={dock.team}
          supabase={dock.supabase}
          workspace={dock.workspace}
          answerHref={`#${QUESTION_ANCHOR}`}
        />
      )}

      {owner && (
        <p>
          <button type="button" className="ask-button quiet" disabled={deleting} onClick={onDelete}>
            {deleting ? 'Deleting…' : 'Delete this session'}
          </button>
        </p>
      )}
    </div>
  );
}
