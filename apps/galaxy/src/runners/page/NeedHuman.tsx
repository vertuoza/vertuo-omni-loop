'use client';
import { createContext, useCallback, useContext, useEffect, useId, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react';
import { useRouter } from 'next/navigation';
import type { IssueNumber } from 'omni-loop/kit/lib/ids.ts';
import { emptyDraft, pickOption, shownLabel, toggleOther, typeOther, type AskQuestion, type Draft, type Pick } from '../../ask/answer-model';
import { OptionDescription, QuestionHeading } from '../../ask/page/QuestionText';
import { renderMarkdownBody } from '../../dossier/markdown';
import { answerRunnerJob, dismissRunnerJob, readJobQuestions, type Called } from '../runners.client';
import { ANSWER_CHARS, type JobQuestions } from '../runners.contract';
import { repoName } from './model';
import {
  answersOf, closed, closedAfter, demoPort, drawerMove, issueUrl, LOADING, NONE, opened, readingOf, refusedAsClosed, withAnswer, WORDS, type AnswerState, type NeedHumanPort, type Reading,
} from './need-human';
import './need-human.css';

// The Need human drawer (PRD 2255 s3, the `runner-need-human` screen): a job that ended with questions open reads
// Need human on the Runners page, with a button that opens this panel over the right of the page (the whole width
// under 720 px), as the Terminal panel opens. `?answer=<job id>` opens it too, so the issue's link lands here. It
// reads the job's questions when it opens, shows the lead and each question with its options and a free answer of
// at most 2,000 characters, and Send answers, disabled until every question has an answer, queues the resume job and
// closes it; Dismiss closes the questions with no job. A row someone closed reads who, with neither button. The
// focus moves inside it on open, Tab stays inside it, and Escape, the close button or the dimmed page close it and
// give the focus back to the job's button. The rules live in ./need-human.ts; this file draws them.

/** A job as the drawer's header names it. */
export type NeedJob = { id: string; repo: string };

const Opener = createContext<(job: string) => void>(() => undefined);

/** The routes' port: the page's session goes with each call. */
const LIVE: NeedHumanPort = {
  read: (job) => readJobQuestions(job),
  answer: (job, answers) => answerRunnerJob(job, answers),
  dismiss: (job) => dismissRunnerJob(job),
};

/** The demo answers as its viewer, and queues a job of its own, in memory. */
const DEMO_LOGIN = 'you';
const DEMO_RESUME = '00000000-0000-4000-8000-00000000d2ff';

/** The Need human button of a job: opens the drawer on it. */
export function NeedHumanButton({ job }: { job: string }) {
  const open = useContext(Opener);
  return <button type="button" className="runners-ghost is-need" data-answer={job} onClick={() => { open(job); }}>{WORDS.need}</button>;
}

/** The job's button, else its Terminal button, which the focus returns to once the drawer closes. */
function buttonOf(job: string): HTMLElement | null {
  return document.querySelector<HTMLElement>(`[data-answer="${job}"]`) ?? document.querySelector<HTMLElement>(`[data-terminal="${job}"]`);
}

/** Holds which drawer is open, from `?answer=` on the first draw, mirrors it in the URL (history.replaceState, which Next follows, so
 * the page's refresh draws the same URL), carries out the focus moves, and draws the drawer over the page. `demo` holds the
 * questions of the demo page, which the drawer then reads and answers in the browser. */
export function NeedHumanProvider({ initial, jobs, demo, children }: { initial: string | null; jobs: readonly NeedJob[]; demo: readonly JobQuestions[] | null; children: ReactNode }) {
  const router = useRouter();
  const [state, setState] = useState<AnswerState>(initial === null ? NONE : opened(initial));
  const port = useMemo(() => (demo === null ? LIVE : demoPort(demo, DEMO_LOGIN, { id: DEMO_RESUME })), [demo]);
  const open = useCallback((job: string) => { setState(opened(job)); }, []);
  const close = useCallback(() => { setState(closed); }, []);
  const sent = useCallback(() => {
    setState(closed);
    router.refresh();
  }, [router]);

  // `null` as the state, as Next's guide does: it then follows the new URL (its own state would make the page's 5 s
  // refresh draw the old one again).
  useEffect(() => {
    window.history.replaceState(null, '', withAnswer(window.location.href, state.open));
  }, [state.open]);
  useEffect(() => {
    if (state.focus === 'button' && state.job !== null) buttonOf(state.job)?.focus();
  }, [state]);

  const job = state.open === null ? null : jobs.find((listed) => listed.id === state.open) ?? null;
  return (
    <Opener value={open}>
      {children}
      {job === null ? null : (
        <NeedHumanDrawer key={job.id} id={job.id} repo={job.repo} port={port} seed={demo?.find((row) => row.job === job.id) ?? null} onClose={close} onSent={sent} />
      )}
    </Opener>
  );
}

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled])';

/** The drawer on one job, live: its read, its answers, its keys and its focus. */
function NeedHumanDrawer({ id, repo, port, seed, onClose, onSent }: {
  id: string; repo: string; port: NeedHumanPort; seed: JobQuestions | null; onClose: () => void; onSent: () => void;
}) {
  const [reading, setReading] = useState<Reading>(() => (seed === null ? LOADING : readingOf({ ok: true, value: seed })));
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const panel = useRef<HTMLElement | null>(null);

  // The drawer reads the questions from its port as it opens, whichever the first drawing held: the demo's row seeds the
  // server's markup, and the port's own copy, which remembers an answer sent earlier, then replaces it.
  useEffect(() => {
    let live = true;
    void port.read(id).then((called) => {
      if (!live) return;
      const next = readingOf(called);
      if (next.kind === 'missing') onClose();
      else setReading(next);
    });
    return () => { live = false; };
  }, [id, port, onClose]);

  useEffect(() => { panel.current?.focus(); }, []);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const root = panel.current;
      if (root === null) return;
      const move = drawerMove(event.key, event.shiftKey, [...root.querySelectorAll<HTMLElement>(FOCUSABLE)], document.activeElement);
      if (move.kind === 'none') return;
      event.preventDefault();
      if (move.kind === 'close') onClose();
      else move.item.focus();
    };
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('keydown', onKey); };
  }, [onClose]);

  const asked = reading.kind === 'open' ? reading.asked : null;
  const current = asked === null ? null : draft ?? emptyDraft(asked);

  async function act(call: () => Promise<Called<unknown>>) {
    setBusy(true);
    setProblem(null);
    const called = await call();
    if (called.ok) {
      onSent();
      return;
    }
    setBusy(false);
    const words = refusedAsClosed(called.error);
    // Someone came first: the row read again names who, an API key by its name, which the refusal's words may not.
    if (words !== null && reading.kind === 'open') setReading(closedAfter(words, await port.read(id), reading.row.issue));
    else setProblem(called.error);
  }
  const answers = asked !== null && current !== null ? answersOf(asked, current) : null;

  return (
    <NeedHumanView
      repo={repo} reading={reading} draft={current} panel={panel} busy={busy} problem={problem} canSend={answers !== null}
      onDraft={setDraft} onClose={onClose}
      onSend={() => { if (answers !== null) void act(() => port.answer(id, answers)); }}
      onDismiss={() => { void act(() => port.dismiss(id)); }}
    />
  );
}

interface NeedHumanViewProps {
  repo: string;
  reading: Reading;
  /** The picks so far, one per question, while the questions are open. */
  draft?: Draft | null;
  panel?: RefObject<HTMLElement | null>;
  busy?: boolean;
  problem?: string | null;
  canSend?: boolean;
  onDraft?: (draft: Draft) => void;
  onSend?: () => void;
  onDismiss?: () => void;
  onClose?: () => void;
}

/** The header: `Need human · <repo> · #<issue>`, the issue linking its page on GitHub, and the close button. */
function Head({ titleId, repo, issue, onClose }: { titleId: string; repo: string; issue: IssueNumber | null; onClose?: (() => void) | undefined }) {
  return (
    <header className="need-head">
      <span className="need-title" id={titleId}>
        {WORDS.need} · <span data-content title={repo}>{repoName(repo)}</span>
        {issue === null ? null : <> · <a href={issueUrl(repo, issue)} target="_blank" rel="noopener noreferrer" data-content>#{issue}</a></>}
      </span>
      <button type="button" className="need-close" aria-label={WORDS.close} onClick={onClose}>×</button>
    </header>
  );
}

/** One question: its header chip, its text, its options, and a free answer of at most 2,000 characters. */
function NeedQuestion({ name, question, pick, update }: { name: string; question: AskQuestion; pick: Pick; update: (pick: Pick) => void }) {
  const kind = question.multiSelect ? 'checkbox' : 'radio';
  return (
    <section className="ask-q need-q" aria-labelledby={`${name}-text`}>
      <div className="ask-q-head">
        {question.header && <span className="ask-chip" data-content>{question.header}</span>}
        <span className="ask-pick-hint">{question.multiSelect ? 'Pick any that apply' : 'Pick one'}</span>
      </div>
      <div data-content><QuestionHeading id={`${name}-text`} text={question.question} /></div>
      <fieldset className="ask-opts" data-multi={question.multiSelect}>
        <legend className="ask-sr">{question.question}</legend>
        {question.options.map((option, k) => {
          const shown = shownLabel(option.label);
          return (
            <label className="ask-opt" key={k}>
              <input type={kind} name={name} value={option.label} checked={pick.labels.includes(option.label)} onChange={() => { update(pickOption(question, pick, option.label)); }} />
              <span className="ask-key" aria-hidden="true" />
              <span data-content>
                <span className="ask-opt-label">{shown.text}{shown.recommended && <span className="ask-rec">Recommended</span>}</span>
                {option.description && <OptionDescription text={option.description} />}
              </span>
            </label>
          );
        })}
        <div className="ask-opt ask-other">
          <input id={`${name}-other`} type={kind} name={name} checked={pick.otherOn} onChange={() => { update(toggleOther(question, pick)); }} />
          <label htmlFor={`${name}-other`} className="ask-other-head">
            <span className="ask-key" aria-hidden="true">…</span>
            <span className="ask-opt-label">{WORDS.own}</span>
          </label>
          <textarea
            className="ask-other-text" rows={2} maxLength={ANSWER_CHARS} aria-label={`${WORDS.own}: ${question.question}`}
            value={pick.otherText} onChange={(event) => { update(typeOther(question, pick, event.target.value)); }}
          />
        </div>
      </fieldset>
    </section>
  );
}

/** What the body holds: the lead and the questions to answer, who closed them, a read in progress, or why it failed. */
function Body({ reading, draft, update }: { reading: Reading; draft: Draft | null; update: (draft: Draft) => void }) {
  const name = useId();
  if (reading.kind === 'closed') return <p className="need-closed" role="status" data-content>{reading.words}</p>;
  if (reading.kind === 'failed') return <p className="need-problem" role="alert">{reading.words}</p>;
  if (reading.kind !== 'open' || draft === null) return <p className="need-note" role="status">{WORDS.loading}</p>;
  return (
    <>
      <div className="ask-prose need-lead" data-content dangerouslySetInnerHTML={{ __html: renderMarkdownBody(reading.row.lead) }} />
      {reading.asked.map((question, index) => {
        const pick = draft[index];
        return pick === undefined ? null : (
          <NeedQuestion key={index} name={`${name}-${String(index)}`} question={question} pick={pick} update={(next) => { update(draft.map((p, i) => (i === index ? next : p))); }} />
        );
      })}
    </>
  );
}

/** The drawer as drawn: header, body, and, while the questions are open, the foot with Dismiss and Send answers. */
function NeedHumanView({ repo, reading, draft = null, panel, busy = false, problem = null, canSend = false, onDraft, onSend, onDismiss, onClose }: NeedHumanViewProps) {
  const titleId = `${useId()}-title`;
  const issue = reading.kind === 'open' ? reading.row.issue : reading.kind === 'closed' ? reading.issue : null;
  return (
    <div className="need-over">
      <div className="need-scrim" aria-hidden="true" onClick={onClose} />
      <section className="need" data-screen="runner-need-human" role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1} ref={panel}>
        <Head titleId={titleId} repo={repo} issue={issue} onClose={onClose} />
        <div className="need-body">
          <Body reading={reading} draft={draft} update={(next) => { onDraft?.(next); }} />
        </div>
        {reading.kind === 'open' && (
          <footer className="need-foot">
            {problem !== null && <p className="need-problem" role="alert">{problem}</p>}
            <button type="button" className="ask-button quiet" disabled={busy} onClick={onDismiss}>{WORDS.dismiss}</button>
            <button type="button" className="ask-button" data-primary disabled={busy || !canSend} onClick={onSend}>{busy ? WORDS.sending : WORDS.send}</button>
          </footer>
        )}
      </section>
    </div>
  );
}
