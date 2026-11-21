'use client';
import { Fragment, useEffect, useMemo, useState } from 'react';
import { Button, EmptyState, Notice, SegmentedControl, Skeleton, Tag, Textarea } from '@omni/ui';
import { demoCommanderPort, httpCommanderPort, type Asked, type CommanderPort } from './commander.client';
import type { CommanderView, Message } from './commander.contract';
import { clockOf, dayOf, dayWords, readingWords, readLines, readWords, removedWords, tokensWords, usedUpWords, WORDS } from './commander';
import { jobHref } from '../../runners/send/targets';
import { cardsAfter, useRail, WaitingRail, type RailProps } from './WaitingRail';
import { notebooksAfter, NotebooksDrawer, useNotebooks, type NotebooksProps } from './Notebooks';
import './commander.css';

// The Commander tab of a Virtual Fleet (PRD 3107 s1, the `fleet-commander` screen's 2.A thread, 2.C, 2.D, 2.E and 2.F):
// the status line read from the database (missions running, waiting and paused, each a link, and today's tokens), then
// the thread: a member's question signed by their login, the Commander's reply signed with its glyph and `Commander ·
// agent`, a bold verdict, one row per claim with its source as a chip (hovering shows that record's own line and time),
// and a footer of what it read and what it removed. Then the box. A first visit offers three questions; while it reads,
// a pending row says what; off, it says so and links Settings; out of tokens, a notice takes the box's place. The rules
// live in ./commander.ts; CommanderBody draws one state, CommanderTab holds it and makes the calls. Beside the thread,
// in every state, off and out of tokens included, the Waiting on you rail (s2, ./WaitingRail.tsx), which needs no model.
// The box has two modes (s3): Ask, and Message fleet, whose message joins the thread tagged `To the fleet`, reads `Waiting for
// next job` until a job claimed it and `Read by <role> · job <id>` after, and warns before it is sent when no mission runs.
// The status line ends with `Notebooks · <n>` (s4), which opens the Notebooks drawer (./Notebooks.tsx).

export type BoxMode = 'ask' | 'message';

export interface CommanderBodyProps {
  view: CommanderView;
  now: Date;
  /** The question being read, not yet answered. */
  pending: string | null;
  draft: string;
  /** A refusal that is not the thread's: shown under the box. */
  problem: string | null;
  onDraft: (text: string) => void;
  onAsk: (text: string) => void;
  /** What the box does (s3): ask the Commander, or message the fleet's agents. Ask when not given. */
  mode?: BoxMode;
  onMode?: (mode: BoxMode) => void;
  /** A message to the fleet is on its way (s3). */
  sending?: boolean;
  onSend?: (text: string) => void;
  /** The rail's state and moves; its cards and the member's login are the view's. */
  rail: Omit<RailProps, 'cards' | 'me'>;
  /** The Notebooks drawer's state and moves (s4); its notebooks and the member's login are the view's. At rest when not given. */
  notes?: NotesMoves;
}

type NotesMoves = Omit<NotebooksProps, 'notebooks' | 'me'>;

/** The drawer as nobody has touched it. */
const NOTES_AT_REST: NotesMoves = { pending: new Map(), shown: new Set(), problem: null, onDelete: () => undefined, onUndo: () => undefined, onShow: () => undefined };

/** The rail as nobody has touched it. */
export const RAIL_AT_REST: Omit<RailProps, 'cards' | 'me' | 'onPick' | 'onConfirm' | 'onCancel'> = { confirming: null, sending: false, problems: new Map() };

const SETTINGS_PATH = '/app/settings';
const missionsHref = (fleet: string) => `/app/fleet?fleet=${encodeURIComponent(fleet)}&tab=missions`;

/** The Commander's mark: a role glyph, never a face (never#10). */
function Glyph({ big = false }: { big?: boolean }) {
  return (
    <svg className={big ? 'commander-glyph commander-glyph-big' : 'commander-glyph'} viewBox="0 0 4 4" aria-hidden="true" focusable="false">
      <rect x="0" y="0" width="1" height="1" fill="currentColor" />
      <rect x="3" y="0" width="1" height="1" fill="currentColor" />
      <rect x="1" y="1" width="2" height="2" fill="currentColor" />
    </svg>
  );
}

function Status({ view, notes = NOTES_AT_REST }: { view: CommanderView; notes?: NotesMoves | undefined }) {
  const href = missionsHref(view.fleet);
  const { status } = view;
  return (
    <div className="commander-strip">
      <p aria-label={WORDS.status}>
        <a href={href}>{`${String(status.running)} ${WORDS.running}`}</a>{' · '}
        <a href={href}>{`${String(status.waiting)} ${WORDS.waiting}`}</a>{' · '}
        <a href={href}>{`${String(status.paused)} ${WORDS.paused}`}</a>{' · '}
        <span>{tokensWords(status)}</span>
      </p>
      <NotebooksDrawer notebooks={view.notebooks} me={view.me} {...notes} />
    </div>
  );
}

function Question({ message }: { message: Extract<Message, { kind: 'question' }> }) {
  return (
    <li className="commander-msg commander-person">
      <p className="commander-who">{message.login} · <time dateTime={message.at}>{clockOf(message.at)}</time></p>
      <p className="commander-text">{message.text}</p>
    </li>
  );
}

/** A member's message to the fleet's agents: tagged `To the fleet`, then who read it, or that it waits for the next job. */
function ToFleet({ message }: { message: Extract<Message, { kind: 'fleet' }> }) {
  return (
    <li className="commander-msg commander-person">
      <p className="commander-who">{message.login} · <time dateTime={message.at}>{clockOf(message.at)}</time> <Tag>{WORDS.toFleet}</Tag></p>
      <p className="commander-text">{message.text}</p>
      {message.reads.length === 0
        ? <p className="commander-foot">{WORDS.waitingForJob}</p>
        : message.reads.map((read) => <p key={read.job + read.role} className="commander-foot"><a href={jobHref(read.job)}>{readLines([read])[0]}</a></p>)}
    </li>
  );
}

function Signature({ at }: { at: string | null }) {
  return (
    <p className="commander-who">
      <Glyph />{WORDS.tab} <Tag>{WORDS.agent}</Tag>
      {at !== null && <> · <time dateTime={at}>{clockOf(at)}</time></>}
    </p>
  );
}

function Reply({ message }: { message: Extract<Message, { kind: 'reply' }> }) {
  const { reply } = message;
  return (
    <li className="commander-msg commander-agent">
      <Signature at={message.at} />
      {reply.verdict === null ? <p className="commander-verdict">{WORDS.notFound}</p> : (
        <>
          <p className="commander-verdict">{reply.verdict}</p>
          <ul className="commander-claims">
            {reply.claims.map((claim, n) => (
              <li key={n}>
                <span className="commander-claim">{claim.text}</span>
                <span className="commander-sources">
                  {claim.sources.map((source) => <a key={source.href + source.label} className="commander-chip" href={source.href} title={source.line}>{source.label}</a>)}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
      <p className="commander-foot">{readWords(reply.read, message.at)}</p>
      {reply.removed > 0 && <p className="commander-foot">{removedWords(reply.removed)}</p>}
    </li>
  );
}

/** The thread, by day: each question, its reply, or that it got none. */
function Thread({ messages, now, pending, reading }: { messages: readonly Message[]; now: Date; pending: string | null; reading: string }) {
  const answered = new Set(messages.flatMap((m) => (m.kind === 'reply' ? [m.replyTo] : [])));
  const today = now.toISOString();
  return (
    <ol className="commander-thread" aria-label={WORDS.thread}>
      {messages.map((message, n) => {
        const before = messages[n - 1];
        return (
          <Fragment key={message.id}>
            {(before === undefined || dayOf(before.at) !== dayOf(message.at)) && <li className="commander-day">{dayWords(message.at, now)}</li>}
            {message.kind === 'question' && <Question message={message} />}
            {message.kind === 'reply' && <Reply message={message} />}
            {message.kind === 'fleet' && <ToFleet message={message} />}
            {message.kind === 'question' && !answered.has(message.id) && <li className="commander-msg commander-agent"><p className="commander-failed" role="status">{WORDS.noAnswer}</p></li>}
          </Fragment>
        );
      })}
      {pending !== null && (
        <>
          {(messages.length === 0 || dayOf(messages[messages.length - 1]?.at ?? today) !== dayOf(today)) && <li className="commander-day">{WORDS.today}</li>}
          <li className="commander-msg commander-person"><p className="commander-text">{pending}</p></li>
          <li className="commander-msg commander-agent" aria-busy="true">
            <Signature at={null} />
            <p className="commander-reading" role="status">{reading}</p>
            <Skeleton shape="text" label={reading} lines={2} />
          </li>
        </>
      )}
    </ol>
  );
}

function Box({ draft, busy, mode, running, onMode, onDraft, onAsk, onSend }: {
  draft: string; busy: boolean; mode: BoxMode; running: number;
  onMode: (mode: BoxMode) => void; onDraft: (text: string) => void; onAsk: (text: string) => void; onSend: (text: string) => void;
}) {
  const messaging = mode === 'message';
  return (
    <form className="commander-box" onSubmit={(event) => { event.preventDefault(); if (draft.trim() !== '') (messaging ? onSend : onAsk)(draft.trim()); }}>
      <SegmentedControl label={WORDS.mode} size="sm" value={mode} onChange={(id) => { onMode(id === 'message' ? 'message' : 'ask'); }}
        options={[{ id: 'ask', label: WORDS.modeAsk }, { id: 'message', label: WORDS.modeMessage }]} />
      <Textarea
        label={messaging ? WORDS.message : WORDS.question} name={messaging ? 'message' : 'question'} rows={2}
        placeholder={messaging ? WORDS.placeholderMessage : WORDS.placeholder} value={draft} disabled={busy} onChange={(event) => { onDraft(event.target.value); }}
      />
      <Button variant="primary" type="submit" disabled={busy || draft.trim() === ''}>{messaging ? WORDS.send : WORDS.ask}</Button>
      {messaging && running === 0 && <p className="commander-nomission" role="note">{WORDS.noMission}</p>}
    </form>
  );
}

/** The thread's column of a Commander that answers or is out of tokens: the first visit or the thread, then the box. */
function Main({ view, now, pending, draft, problem, onDraft, onAsk, mode, onMode, sending, onSend }: Omit<CommanderBodyProps, 'rail' | 'notes' | 'mode' | 'onMode' | 'sending' | 'onSend'> & Required<Pick<CommanderBodyProps, 'mode' | 'onMode' | 'sending' | 'onSend'>>) {
  const first = view.messages.length === 0 && pending === null;
  const reading = readingWords(view.reading.missions, view.reading.jobs);
  return (
    <div className="commander-main">
      {first && view.state.kind === 'ready' ? (
        <div className="commander-first">
          <Glyph big />
          <EmptyState title={WORDS.firstVisit} size="inline" />
          <p className="commander-suggestions">
            {view.suggestions.map((suggestion) => <Button key={suggestion} variant="quiet" size="sm" onClick={() => { onAsk(suggestion); }}>{suggestion}</Button>)}
          </p>
        </div>
      ) : <Thread messages={view.messages} now={now} pending={pending} reading={reading} />}
      {view.state.kind === 'used-up'
        ? <Notice tone="warning" title={usedUpWords(view.state.backAt)} />
        : <Box draft={draft} busy={pending !== null || sending} mode={mode} running={view.status.running} onMode={onMode} onDraft={onDraft} onAsk={onAsk} onSend={onSend} />}
      {problem !== null && <p className="commander-problem" role="alert">{problem}</p>}
    </div>
  );
}

/** One state of the tab, drawn from what it was given. */
export function CommanderBody({ view, now, pending, draft, problem, onDraft, onAsk, mode = 'ask', onMode = () => undefined, sending = false, onSend = () => undefined, rail, notes }: CommanderBodyProps) {
  const railed = <WaitingRail cards={view.cards} me={view.me} {...rail} />;
  if (view.state.kind === 'off') {
    return (
      <section className="commander" data-screen="fleet-commander" aria-label={WORDS.tab}>
        <div className="commander-cols">
          <div className="commander-main commander-off">
            <Glyph big />
            <EmptyState title={WORDS.off} size="inline" action={<Button variant="quiet" href={SETTINGS_PATH}>{WORDS.settings}</Button>} />
          </div>
          {railed}
        </div>
      </section>
    );
  }
  return (
    <section className="commander" data-screen="fleet-commander" aria-label={WORDS.tab}>
      <Status view={view} notes={notes} />
      <div className="commander-cols">
        <Main view={view} now={now} pending={pending} draft={draft} problem={problem} onDraft={onDraft} onAsk={onAsk} mode={mode} onMode={onMode} sending={sending} onSend={onSend} />
        {railed}
      </div>
    </section>
  );
}

export interface CommanderTabProps {
  /** The fleet's workspace; null in the demo world, which has no Commander. */
  workspace: string | null;
  fleet: string;
  /** The tab as read, when the caller has it; otherwise it reads itself. */
  view?: CommanderView;
  /** Replaces the calls, for the tests. */
  port?: CommanderPort;
  /** The clock, for the tests. */
  now?: Date;
}

/** The view once an ask came back: its question and reply, or the question kept with no answer and the state it says. */
function viewAfterAsk(was: CommanderView, asked: Asked): CommanderView {
  if (asked.ok) return { ...was, messages: [...was.messages, asked.answer.question, asked.answer.reply] };
  return { ...was, messages: asked.question === null ? was.messages : [...was.messages, asked.question], state: asked.state ?? was.state };
}

/** The tab while it reads, or why it could not. */
function Loading({ problem }: { problem: string | null }) {
  return (
    <section className="commander" data-screen="fleet-commander" aria-label={WORDS.tab}>
      {problem === null ? <Skeleton shape="block" label={WORDS.loading} /> : <p className="commander-problem" role="alert">{problem}</p>}
    </section>
  );
}

/** A change to the view once it was read; none before. */
const onView = (change: (view: CommanderView) => CommanderView) => (was: CommanderView | null): CommanderView | null => (was === null ? was : change(was));

export function CommanderTab({ workspace, fleet, view: given, port, now }: CommanderTabProps) {
  const calls = useMemo(() => port ?? (workspace === null ? demoCommanderPort : httpCommanderPort(workspace, fleet)), [port, workspace, fleet]);
  const [view, setView] = useState<CommanderView | null>(given ?? null);
  const [problem, setProblem] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [mode, setMode] = useState<BoxMode>('ask');
  const [sending, setSending] = useState(false);
  const rail = useRail(calls, (key, sent) => { setView(onView((was) => ({ ...was, cards: cardsAfter(was.cards, key, sent) }))); });
  const notes = useNotebooks(calls, (note) => { setView(onView((was) => ({ ...was, notebooks: notebooksAfter(was.notebooks, note) }))); });

  useEffect(() => {
    if (given) return undefined;
    let live = true;
    void calls.load().then((loaded) => {
      if (!live) return;
      if (loaded.ok) setView(loaded.view);
      else setProblem(loaded.message);
    });
    return () => { live = false; };
  }, [calls, given]);

  async function ask(text: string) {
    setPending(text);
    setProblem(null);
    const asked = await calls.ask(text);
    setPending(null);
    setView(onView((was) => viewAfterAsk(was, asked)));
    if (asked.ok || asked.question !== null) setDraft('');
    else if (asked.state === null) setProblem(asked.message);
  }

  async function send(text: string) {
    setSending(true);
    setProblem(null);
    const sent = await calls.send(text);
    setSending(false);
    if (sent.ok) {
      setDraft('');
      setView(onView((was) => ({ ...was, messages: [...was.messages, sent.message] })));
      return;
    }
    setProblem(sent.message);
  }

  if (view === null) return <Loading problem={problem} />;
  return <CommanderBody view={view} now={now ?? new Date()} pending={pending} draft={draft} problem={problem} onDraft={setDraft} onAsk={(text) => { void ask(text); }}
      mode={mode} onMode={setMode} sending={sending} onSend={(text) => { void send(text); }} rail={rail} notes={notes} />;
}
