'use client';
import { createContext, useContext, useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { CopyCommand } from '../../roadmap/page/CopyCommand';
import { readJobLines } from '../runners.client';
import type { Job } from '../runners.contract';
import {
  drawn, EMPTY_TERMINAL, followJob, isLive, noticeOf, UPDATE_COMMAND, withTerminal, WORDS, atBottom, type TerminalNotice, type TerminalState,
} from './terminal-model';
import './terminal.css';

// The Terminal panel (PRD 1904 s4, the `runner-terminal` screen): a read-only live view of one job's log,
// sliding over the right of the Runners page (the whole width under 720 px). The page's Terminal buttons
// open it through TerminalProvider, which holds the open job across the page's 5 s refresh and mirrors it
// in `?terminal=<job id>` (history.replaceState, so the refresh draws the same URL). Escape, the close
// button or the dimmed page behind close it. The reads and the rules live in ./terminal-model.ts; this file
// only draws them, and follows the newest line while the scroll is at the bottom. No input of any kind.

/** A job as the panel's header names it. */
export type TerminalJob = { id: string; repo: string; runner: string | null; status: Job['status'] };

const Opener = createContext<(job: string) => void>(() => undefined);

const STATUS: Record<Job['status'], string> = {
  queued: 'Queued', claimed: 'Starting', running: 'Running', done: 'Done', failed: 'Failed', cancelled: 'Cancelled',
};
const TONE: Record<Job['status'], string> = { queued: 'queue', claimed: 'run', running: 'run', done: 'done', failed: 'fail', cancelled: 'off' };

/** A Terminal button: opens the panel on `job`, or is disabled, titled "No job yet", with none. */
export function TerminalButton({ job }: { job: string | null }) {
  const open = useContext(Opener);
  if (job === null) return <button type="button" className="runners-ghost" disabled title={WORDS.noJob}>Terminal</button>;
  return <button type="button" className="runners-ghost" data-terminal={job} onClick={() => { open(job); }}>Terminal</button>;
}

/** Holds which job's panel is open, from `?terminal=` on the first draw, and draws the panel over the page. */
export function TerminalProvider({ initial, jobs, children }: { initial: string | null; jobs: readonly TerminalJob[]; children: ReactNode }) {
  const [open, setOpen] = useState<string | null>(initial);
  const show = (job: string | null) => {
    setOpen(job);
    window.history.replaceState(window.history.state, '', withTerminal(window.location.href, job));
  };
  return (
    <Opener value={show}>
      {children}
      {open === null ? null : <Terminal key={open} id={open} job={jobs.find((j) => j.id === open) ?? null} onClose={() => { show(null); }} />}
    </Opener>
  );
}

/** The panel on one job, live: its reads, its following, Escape. */
function Terminal({ id, job, onClose }: { id: string; job: TerminalJob | null; onClose: () => void }) {
  const [state, setState] = useState<TerminalState>(EMPTY_TERMINAL);
  const [following, setFollowing] = useState(true);
  const box = useRef<HTMLDivElement>(null);
  const listed = job !== null;

  useEffect(() => (listed ? followJob((after) => readJobLines(id, after), setState, document) : undefined), [id, listed]);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('keydown', onKey); };
  }, [onClose]);
  useLayoutEffect(() => {
    if (following && box.current) box.current.scrollTop = box.current.scrollHeight;
  }, [state.lines, following]);

  return (
    <TerminalView id={id} job={job} state={state} following={following} box={box}
      onScroll={() => { if (box.current) setFollowing(atBottom(box.current)); }}
      onJump={() => { setFollowing(true); }} onClose={onClose} />
  );
}

export interface TerminalViewProps {
  id: string;
  job: TerminalJob | null;
  state: TerminalState;
  following: boolean;
  box?: RefObject<HTMLDivElement | null>;
  onScroll?: () => void;
  onJump?: () => void;
  onClose?: () => void;
}

/** The header: the job, its status with a live dot while it runs, Reconnecting… after a failed read, close. */
function Head({ title, status, failed, onClose }: { title: string; status: Job['status'] | null; failed: boolean; onClose?: (() => void) | undefined }) {
  return (
    <header className="terminal-head">
      {status !== null && isLive(status) ? <i className="terminal-live" aria-label="Live" /> : null}
      <span className="terminal-title" data-content>{title}</span>
      {failed ? <span className="terminal-reconnecting" role="status">{WORDS.reconnecting}</span> : null}
      {status === null ? null : <span className={`runners-status is-${TONE[status]}`}>{STATUS[status]}</span>}
      <button type="button" className="terminal-close" aria-label="Close" onClick={onClose}>×</button>
    </header>
  );
}

/** The lines, dropped ones said above the first. */
function Lines({ lines, dropped }: { lines: TerminalState['lines']; dropped: boolean }) {
  return (
    <pre className="terminal-lines" data-content>
      {dropped ? <span className="terminal-note">{WORDS.dropped}{'\n'}</span> : null}
      {drawn(lines).map((line) => (
        <span key={line.seq} className={`terminal-line is-${line.tone}`}>
          {line.time === null ? null : <span className="terminal-time">{line.time} </span>}
          {line.href === null ? line.text : <>PR: <a href={line.href} target="_blank" rel="noopener noreferrer">{line.href}</a></>}
          {'\n'}
        </span>
      ))}
    </pre>
  );
}

/** What the body shows: the notice of a panel with no line (waiting, cleared, an old runner's tail), else the lines. */
function Body({ id, state, notice }: { id: string; state: TerminalState; notice: TerminalNotice }) {
  if (notice.kind === 'waiting') return <p className="terminal-note">{WORDS.waiting}</p>;
  if (notice.kind === 'cleared') return <p className="terminal-note">{WORDS.cleared}</p>;
  if (notice.kind === 'old-runner') {
    return (
      <>
        <div className="terminal-old">
          <p className="terminal-note">{WORDS.oldRunner}</p>
          <CopyCommand command={UPDATE_COMMAND} id={`terminal-update-${id}`} />
        </div>
        <pre className="terminal-lines" data-content>{notice.tail}</pre>
      </>
    );
  }
  return state.lines.length === 0 ? null : <Lines lines={state.lines} dropped={notice.kind === 'dropped'} />;
}

/** The header's title: `job <short id> · <repo> · <runner>`, each part it knows. */
function titleOf(id: string, job: TerminalJob | null): string {
  const parts = [`job ${id.slice(0, 8)}`];
  if (job) parts.push(job.repo.slice(job.repo.indexOf('/') + 1));
  if (job?.runner) parts.push(job.runner);
  return parts.join(' · ');
}

/** The panel as drawn: header, notice, lines, Jump to latest while scrolled up. */
export function TerminalView({ id, job, state, following, box, onScroll, onJump, onClose }: TerminalViewProps) {
  const title = titleOf(id, job);
  return (
    <div className="terminal-over">
      <div className="terminal-scrim" aria-hidden="true" onClick={onClose} />
      <section className="terminal" data-screen="runner-terminal" role="dialog" aria-label={`Terminal, ${title}`}>
        <Head title={title} status={state.status ?? job?.status ?? null} failed={state.failed} onClose={onClose} />
        <div className="terminal-body" ref={box} onScroll={onScroll}>
          <Body id={id} state={state} notice={noticeOf(state, job !== null)} />
        </div>
        {following ? null : <button type="button" className="runners-ghost is-primary terminal-jump" data-primary onClick={onJump}>{WORDS.jump}</button>}
      </section>
    </div>
  );
}
