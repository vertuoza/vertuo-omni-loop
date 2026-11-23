'use client';
import { Badge, Button } from '@omni/ui';
import { useCallback, useEffect, useMemo, useState, type Dispatch, type SetStateAction } from 'react';
import { emptyDraft, roundAnswers, type Draft } from '../ask/answer-model';
import { askClient, AskSignedOut } from '../ask/ask.client';
import type { QuestionSource } from '../ask/page/AskQuestion';
import { demoQuestion, demoQuestionPort } from '../ask/page/demo';
import { AnswerList } from '../ask/page/History';
import { LeadMessage } from '../ask/page/LeadMessage';
import { answeredTitle, questionView, type QuestionState, type QuestionView } from '../ask/page/question';
import { QuestionList } from '../ask/page/QuestionText';
import { RoundForm } from '../ask/page/RoundForm';
import type { QuestionPort } from '../ask/page/source';
import { minutesLeft } from '../ask/page/view';
import { questionWrites } from '../ask/page/writes';
import type { InboxRow } from './inbox';
import { hrefOf, rowWords } from './InboxScreen.model';
import { isTyping, listKey } from './keys';

// The Inbox's panel (PRD omni-loop-22, s5): the open item, beside the list from 1280 px, in place under
// its row below. A question is answered here through today's answer form, RoundForm, as the round page
// (/ask/q/<round>, src/ask/page/AskQuestion.tsx) draws it: the round is read from the same route, the
// answer is sent through the same writes (src/ask/page/writes.ts), so the same sign-in and the same
// open-round check (BR-PRODUCT-13) decide, and a given answer is never edited (BR-PRODUCT-12). The form
// keeps its own keys (1 to 4 pick, ↵ sends) and the panel adds ⌘↵: no single key press sends. Once the
// answer is recorded the panel hands the round back (`onSent`), and the Inbox opens the next item,
// staying on the page where the round page would go back. Approvals, outbox items, reviews, runner jobs
// and updates show what waits and a link to their own page: the Inbox approves, answers and merges nothing.

/** A round's answers, by question, as the round page sends them. */
type AskAnswers = Record<string, string>;

const NOT_SENT = 'Your answer did not go through. Check your connection and send it again.';
const NOT_READ = 'This question could not be read. Open its page to answer it.';
const SIGNED_OUT = 'Your sign-in ended. Open the question’s page to sign in and answer it.';

/** The round's reads and writes: the round page's own, or the demo's. */
function portOf(source: QuestionSource, roundId: string): QuestionPort {
  if (source.kind === 'demo') return demoQuestionPort(demoQuestion(Date.now()));
  const client = askClient();
  return { read: () => client.round(roundId), ...questionWrites(client) };
}

/** The round as last read, or why it is not. */
type Read = { state: QuestionState | null; failed: boolean; signedOut: boolean };

const readOf = (state: QuestionState | null): Read => ({ state, failed: state === null, signedOut: false });

/** Reads the round once, unless it was handed already read. */
function useRound(port: QuestionPort, initial: QuestionState | null): [Read, Dispatch<SetStateAction<Read>>] {
  const [read, setRead] = useState<Read>({ state: initial, failed: false, signedOut: false });
  useEffect(() => {
    if (initial) return;
    let live = true;
    port.read().then((state) => {
      if (live) setRead(readOf(state));
    }, (error: unknown) => {
      if (live) setRead({ state: null, failed: !(error instanceof AskSignedOut), signedOut: error instanceof AskSignedOut });
    });
    return () => { live = false; };
  }, [port, initial]);
  return [read, setRead];
}

/** The time, again every 15 s: the minutes left before the question moves to the terminal. */
function useClock(start: number | undefined): number {
  const [now, setNow] = useState(() => start ?? Date.now());
  useEffect(() => {
    const tick = setInterval(() => { setNow(Date.now()); }, 15_000);
    return () => { clearInterval(tick); };
  }, []);
  return now;
}

/** ⌘↵ sends, from the Other field too, while `send` is given; the form's own ↵ is left as it is. */
function useSendChord(send: () => void, ready: boolean) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      if (listKey(event, isTyping(target))?.kind !== 'send') return;
      event.preventDefault();
      if (ready) send();
    };
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('keydown', onKey); };
  }, [send, ready]);
}

/** The form a view opens: an open round this person may answer, the draft drawn, and its answers once every question has one. */
type Form = { view: Extract<QuestionView, { kind: 'open' }>; shown: Draft; answers: AskAnswers | null };

function formOf(view: QuestionView | null, draft: Draft | null): Form | null {
  if (view?.kind !== 'open' || !view.canAnswer) return null;
  const shown = draft ?? emptyDraft(view.questions);
  return { view, shown, answers: roundAnswers(view.questions, shown) };
}

type Sent = { kind: 'sent' } | { kind: 'taken'; next: QuestionState | null } | { kind: 'signed-out' } | { kind: 'failed' };

/** One send through the round page's writes, and what came of it: recorded, taken by someone or the terminal first, or not through. */
async function sendOnce(port: QuestionPort, roundId: string, answers: AskAnswers): Promise<Sent> {
  try {
    if (await port.send(roundId, answers) === 'answered') return { kind: 'sent' };
    return { kind: 'taken', next: await port.read() };
  } catch (error) {
    return error instanceof AskSignedOut ? { kind: 'signed-out' } : { kind: 'failed' };
  }
}

/** What the round shows once read: today's form while it is open to this person, else why not. */
function RoundBody({ state, view, form, onDraft, sending, send, now }: {
  state: QuestionState; view: QuestionView; form: Form | null; onDraft: (draft: Draft) => void; sending: boolean; send: () => void; now: number;
}) {
  switch (view.kind) {
    case 'open':
      if (!form) return <div className="inbox-closed"><p className="inbox-muted">The person who opened this session, or whoever they shared it with, answers it.</p><QuestionList questions={view.questions} /></div>;
      return <RoundForm roundId={state.round.id} questions={view.questions} draft={form.shown} onDraft={onDraft} canSend={form.answers !== null} sending={sending} onSend={send} minutesLeft={minutesLeft(view.movesAt, now)} />;
    case 'answered':
      return <div className="inbox-closed" aria-live="polite"><p className="inbox-strong">{answeredTitle(view)}</p><AnswerList lines={view.lines} className="ask-answered" /></div>;
    case 'moved':
      return <p className="inbox-muted" aria-live="polite">Nobody answered it on the page in time, so the agent asks it in the terminal instead.</p>;
    case 'closed':
      return <p className="inbox-muted" aria-live="polite">Ask mode was switched off before this question was answered.</p>;
  }
}

/** What the panel says before the round is read, or when it cannot be. */
function readLine(read: Read): string | null {
  if (read.signedOut) return SIGNED_OUT;
  if (read.failed) return NOT_READ;
  return read.state ? null : 'Reading the question…';
}

/** The panel's one status line: a send that did not go through, else where the read stands. */
function StatusLine({ problem, read }: { problem: string | null; read: Read }) {
  const line = problem ?? readLine(read);
  if (!line) return null;
  return <p className={read.state ? 'inbox-problem' : 'inbox-muted'} role="status">{line}</p>;
}

type QuestionPanelProps = {
  roundId: string;
  context: string;
  source: QuestionSource;
  me: string | null;
  /** Called once this person's answer is recorded. */
  onSent: (roundId: string) => void;
  /** The round as already read: what the render tests hand; the panel reads it otherwise. */
  initial?: QuestionState | null;
  /** The clock to start from: the render tests' fixed time. */
  now?: number;
};

/** Send, once the answers are whole and nothing is on its way: what came of it lands on the round read,
 * on `onSent`, or as the problem said. */
function useSend(port: QuestionPort, roundId: string, answers: AskAnswers | null, onSent: (roundId: string) => void, setRead: Dispatch<SetStateAction<Read>>) {
  const [sending, setSending] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const landed = useCallback((sent: Sent) => {
    setSending(false);
    if (sent.kind === 'sent') onSent(roundId);
    else if (sent.kind === 'taken') setRead((r) => ({ ...r, state: sent.next ?? r.state }));
    else if (sent.kind === 'signed-out') setRead((r) => ({ ...r, signedOut: true }));
    else setProblem(NOT_SENT);
  }, [onSent, roundId, setRead]);
  const send = useCallback(() => {
    if (!answers || sending) return;
    setSending(true);
    setProblem(null);
    void sendOnce(port, roundId, answers).then(landed);
  }, [answers, sending, port, roundId, landed]);
  return { send, sending, problem, ready: answers !== null && !sending };
}

/** The round, once read: the agent's lead (until the session closed), then what it shows. */
function ReadRound({ state, view, ...body }: Parameters<typeof RoundBody>[0]) {
  return (
    <>
      {view.kind !== 'closed' && <LeadMessage key={state.round.id} lead={state.round.lead} />}
      <RoundBody state={state} view={view} {...body} />
    </>
  );
}

/** A question, open in the panel: its round read, then today's answer form. */
export function QuestionPanel({ roundId, context, source, me, onSent, initial = null, now: start }: QuestionPanelProps) {
  const port = useMemo(() => portOf(source, roundId), [source, roundId]);
  const [read, setRead] = useRound(port, initial);
  const now = useClock(start);
  const [draft, setDraft] = useState<Draft | null>(null);
  const view = read.state ? questionView(read.state, me, [], now) : null;
  const form = formOf(view, draft);
  const { send, sending, problem, ready } = useSend(port, roundId, form?.answers ?? null, onSent, setRead);
  useSendChord(send, ready);
  return (
    <section className="inbox-panel" aria-label="The open question" data-open={`question:${roundId}`}>
      <div className="inbox-panel-head">
        <p className="inbox-context">{context}</p>
        <div className="inbox-badges"><Badge tone="info">Blocking: the agent waits</Badge></div>
      </div>
      <StatusLine problem={problem} read={read} />
      {read.state && view && <ReadRound state={read.state} view={view} form={form} onDraft={setDraft} sending={sending} send={send} now={now} />}
      <div className="inbox-panel-foot"><Button variant="quiet" size="sm" href={`/ask/q/${encodeURIComponent(roundId)}`}>Open full page</Button></div>
    </section>
  );
}

const OWN_PAGE: Readonly<Record<Exclude<InboxRow['kind'], 'question'>, string>> = {
  approval: 'Open its review',
  outbox: 'Answer it on its PRD',
  review: 'Open the pull request',
  runner: 'Open Runners',
  update: 'Open it',
};

const WHAT_WAITS: Readonly<Record<Exclude<InboxRow['kind'], 'question'>, string>> = {
  approval: 'You approve it on its PRD’s review, where you read what you approve.',
  outbox: 'An agent decided this alone: answer it on its PRD’s Outbox tab.',
  review: 'It waits on you on GitHub.',
  runner: 'Anyone in the workspace can answer these: they are not counted as yours.',
  update: 'News, not a wait: it is not counted.',
};

/** Any other item, open in the panel: what waits, and the link to its own page. */
export function ItemPanel({ row, now }: { row: Exclude<InboxRow, { kind: 'question' }>; now: number }) {
  const words = rowWords(row, now);
  return (
    <section className="inbox-panel" aria-label="The open item" data-open={row.key}>
      <div className="inbox-panel-head">
        <p className="inbox-context">{words.context}</p>
        <h2 className="inbox-panel-title">{words.text}</h2>
        <div className="inbox-badges">{words.badges.map((b) => <Badge key={b}>{b}</Badge>)}{words.age && <span className="inbox-muted">{words.age}</span>}</div>
      </div>
      <p className="inbox-muted">{WHAT_WAITS[row.kind]}</p>
      <div className="inbox-panel-foot"><Button variant="primary" href={hrefOf(row)} external={row.kind === 'review'}>{OWN_PAGE[row.kind]}</Button></div>
    </section>
  );
}
