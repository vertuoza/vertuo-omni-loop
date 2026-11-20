'use client';
import { Fragment, useEffect, useMemo, useState } from 'react';
import { Button, EmptyState, Notice, Skeleton, Tag, Textarea } from '@omni/ui';
import { demoCommanderPort, httpCommanderPort, type CommanderPort } from './commander.client';
import type { CommanderView, Message } from './commander.contract';
import { clockOf, dayOf, dayWords, readingWords, readWords, removedWords, tokensWords, usedUpWords, WORDS } from './commander';
import { cardsAfter, useRail, WaitingRail, type RailProps } from './WaitingRail';
import './commander.css';

// The Commander tab of a Virtual Fleet (PRD 3107 s1, the `fleet-commander` screen's 2.A thread, 2.C, 2.D, 2.E and 2.F):
// the status line read from the database (missions running, waiting and paused, each a link, and today's tokens), then
// the thread: a member's question signed by their login, the Commander's reply signed with its glyph and `Commander ·
// agent`, a bold verdict, one row per claim with its source as a chip (hovering shows that record's own line and time),
// and a footer of what it read and what it removed. Then the box. A first visit offers three questions; while it reads,
// a pending row says what; off, it says so and links Settings; out of tokens, a notice takes the box's place. The rules
// live in ./commander.ts; CommanderBody draws one state, CommanderTab holds it and makes the calls. Beside the thread,
// in every state, off and out of tokens included, the Waiting on you rail (s2, ./WaitingRail.tsx), which needs no model.

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
  /** The rail's state and moves; its cards and the member's login are the view's. */
  rail: Omit<RailProps, 'cards' | 'me'>;
}

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

function Status({ view }: { view: CommanderView }) {
  const href = missionsHref(view.fleet);
  const { status } = view;
  return (
    <p className="commander-strip" aria-label={WORDS.status}>
      <a href={href}>{`${String(status.running)} ${WORDS.running}`}</a>{' · '}
      <a href={href}>{`${String(status.waiting)} ${WORDS.waiting}`}</a>{' · '}
      <a href={href}>{`${String(status.paused)} ${WORDS.paused}`}</a>{' · '}
      <span>{tokensWords(status)}</span>
    </p>
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
            {message.kind === 'question' ? <Question message={message} /> : <Reply message={message} />}
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

function Box({ draft, busy, onDraft, onAsk }: { draft: string; busy: boolean; onDraft: (text: string) => void; onAsk: (text: string) => void }) {
  return (
    <form className="commander-box" onSubmit={(event) => { event.preventDefault(); if (draft.trim() !== '') onAsk(draft.trim()); }}>
      <Textarea label={WORDS.question} name="question" rows={2} placeholder={WORDS.placeholder} value={draft} disabled={busy} onChange={(event) => { onDraft(event.target.value); }} />
      <Button variant="primary" type="submit" disabled={busy || draft.trim() === ''}>{WORDS.ask}</Button>
    </form>
  );
}

/** One state of the tab, drawn from what it was given. */
export function CommanderBody({ view, now, pending, draft, problem, onDraft, onAsk, rail }: CommanderBodyProps) {
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
  const first = view.messages.length === 0 && pending === null;
  const reading = readingWords(view.reading.missions, view.reading.jobs);
  return (
    <section className="commander" data-screen="fleet-commander" aria-label={WORDS.tab}>
      <Status view={view} />
      <div className="commander-cols">
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
            : <Box draft={draft} busy={pending !== null} onDraft={onDraft} onAsk={onAsk} />}
          {problem !== null && <p className="commander-problem" role="alert">{problem}</p>}
        </div>
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

export function CommanderTab({ workspace, fleet, view: given, port, now }: CommanderTabProps) {
  const calls = useMemo(() => port ?? (workspace === null ? demoCommanderPort : httpCommanderPort(workspace, fleet)), [port, workspace, fleet]);
  const [view, setView] = useState<CommanderView | null>(given ?? null);
  const [problem, setProblem] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const rail = useRail(calls, (key, sent) => { setView((was) => (was === null ? was : { ...was, cards: cardsAfter(was.cards, key, sent) })); });

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
    if (asked.ok) {
      setDraft('');
      setView((was) => (was === null ? was : { ...was, messages: [...was.messages, asked.answer.question, asked.answer.reply] }));
      return;
    }
    const { question, state } = asked;
    if (question !== null) setDraft('');
    setView((was) => (was === null ? was : { ...was, messages: question === null ? was.messages : [...was.messages, question], state: state ?? was.state }));
    if (question === null && state === null) setProblem(asked.message);
  }

  if (view === null) {
    return (
      <section className="commander" data-screen="fleet-commander" aria-label={WORDS.tab}>
        {problem === null ? <Skeleton shape="block" label={WORDS.loading} /> : <p className="commander-problem" role="alert">{problem}</p>}
      </section>
    );
  }
  return <CommanderBody view={view} now={now ?? new Date()} pending={pending} draft={draft} problem={problem} onDraft={setDraft} onAsk={(text) => { void ask(text); }} rail={rail} />;
}
