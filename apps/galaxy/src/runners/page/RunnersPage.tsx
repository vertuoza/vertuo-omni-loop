import { Notice } from '../../ask/page/Notice';
import { MemberGate } from '../../dashboard/MemberGate';
import { CopyCommand } from '../../roadmap/page/CopyCommand';
import type { Board, Job, Runner } from '../runners.contract';
import { CancelButton, FleetPicker, Refresh, SendAgainButton } from './actions';
import {
  canCancel, canSendAgain, fleetCell, madeByWords, prWords, repoName, senderWords, START_COMMAND, stateWords, statusTone, statusWords, targetOf, whereWords,
  type Fleet, type RunnersPageView,
} from './model';
import { runnerJob, terminalOf } from './terminal-model';
import { TerminalButton, TerminalProvider, type TerminalJob } from './Terminal';
import '../../dashboard/board/board.css';
import './runners.css';

// /app/runners in each situation (PRD 1830 s3), decided once by the page, as /app/loop decides its own:
// closed, signed out and in no workspace through the shared gate; a read that failed; then the
// workspace's runners and jobs, as the `runners` screen draws them. A runner shows its state, its fleet
// (a picker for a workspace owner, text for everyone else), slots used out of slots, its repositories
// and its kit version. The jobs come queued and running first, then the last 50 that ended; a done one
// links its pull request, Cancel shows on a queued or running job and Send again on a failed or
// cancelled one, the first of them the page's one primary action. Each job and each runner has a
// Terminal button opening the job's live log over the page (PRD 1904 s4, ./Terminal.tsx; a runner's
// opens its running job, else its last). With no runner, the page says how to start one. The controls,
// the panel and the 5 s refresh run in the browser (./actions.tsx, ./Terminal.tsx); the rest is drawn on
// the server, so a refresh draws it again with the new rows, the open panel kept.

type Supabase = { url: string; key: string };

export interface RunnersPageProps {
  view: RunnersPageView;
  supabase: Supabase | null;
  signinError: string | null;
  /** The job whose Terminal panel the URL opens (`?terminal=<job id>`), if any. */
  terminal?: string | null;
}

function Closed() {
  return (
    <Notice title="The Runners page is not open here">
      <p className="ask-muted">This deployment has no database, so it has no runners to show.</p>
    </Notice>
  );
}

function RunnerRow({ runner, board, fleets, now }: { runner: Runner; board: Board; fleets: readonly Fleet[]; now: Date }) {
  const fleet = fleetCell(runner, board.viewer, fleets);
  return (
    <div className="runners-row">
      <span className="runners-name" data-content>{runner.name}</span>
      <span className={`runners-state is-${runner.state}`}><i className="runners-dot" aria-hidden="true" />{stateWords(runner, now)}</span>
      {fleet.kind === 'picker'
        ? <FleetPicker runner={runner.id} name={runner.name} value={fleet.value} options={fleet.options} />
        : <span data-content>{fleet.label}</span>}
      <span data-content>{runner.used} of {runner.slots}</span>
      <span className="runners-repos" data-content title={runner.repos.join(', ')}>{runner.repos.map(repoName).join(' · ')}</span>
      <span className="runners-muted" data-content>{runner.version}</span>
      <TerminalButton job={runnerJob(runner, board.jobs)?.id ?? null} />
    </div>
  );
}

function Action({ job, primary }: { job: Job; primary: boolean }) {
  if (canCancel(job)) return <CancelButton job={job.id} />;
  if (canSendAgain(job)) return <SendAgainButton line={job.line} repo={job.repo} target={targetOf(job)} primary={primary} />;
  if (job.status === 'done' && job.prUrl) return <a href={job.prUrl}>{prWords(job.prUrl)}</a>;
  return null;
}

function JobRow({ job, board, fleets, now, primary }: { job: Job; board: Board; fleets: readonly Fleet[]; now: Date; primary: boolean }) {
  return (
    <div className="runners-row runners-job" id={`job-${job.id}`}>
      <code data-content>{job.line}</code>
      <span className="runners-muted" data-content title={job.repo}>{repoName(job.repo)}</span>
      <span data-content>{senderWords(job)}{madeByWords(job) !== null && <small className="runners-muted runners-made-by"> {madeByWords(job)}</small>}</span>
      <span data-content>{whereWords(job, board.runners, fleets)}</span>
      <span className={`runners-status is-${statusTone(job.status)}`}>{statusWords(job, now)}</span>
      <span className="runners-actions"><TerminalButton job={job.id} /><Action job={job} primary={primary} /></span>
    </div>
  );
}

function Jobs({ board, fleets, now }: { board: Board; fleets: readonly Fleet[]; now: Date }) {
  if (board.jobs.length === 0) return <p className="runners-muted">No job yet.</p>;
  const primary = board.jobs.find(canSendAgain)?.id ?? null;
  return (
    <div className="runners-table runners-jobs">
      <div className="runners-row runners-head"><span>Line</span><span>Repository</span><span>Sent by</span><span>Where</span><span>Status</span><span /></div>
      {board.jobs.map((job) => <JobRow key={job.id} job={job} board={board} fleets={fleets} now={now} primary={job.id === primary} />)}
    </div>
  );
}

function Start() {
  return (
    <section className="board-card runners-start">
      <h2>No runner yet</h2>
      <p className="runners-muted">Start one on a machine:</p>
      <CopyCommand command={START_COMMAND} id="runners-start-command" />
    </section>
  );
}

function Board({ board, fleets, now }: { board: Board; fleets: readonly Fleet[]; now: Date }) {
  return (
    <div className="dash runners" data-screen="runners">
      <h1 className="dash-name">Runners</h1>
      {board.runners.length === 0 ? <Start /> : (
        <>
          <section className="runners-section">
            <h2>Runners</h2>
            <div className="runners-table runners-runners">
              <div className="runners-row runners-head"><span>Runner</span><span>State</span><span>Fleet</span><span>Slots</span><span>Repositories</span><span>Kit</span><span /></div>
              {board.runners.map((runner) => <RunnerRow key={runner.id} runner={runner} board={board} fleets={fleets} now={now} />)}
            </div>
          </section>
          <section className="runners-section">
            <h2>Jobs</h2>
            <Jobs board={board} fleets={fleets} now={now} />
          </section>
        </>
      )}
      <Refresh />
    </div>
  );
}

export function RunnersPage({ view, supabase, signinError, terminal = null }: RunnersPageProps) {
  if (view.kind === 'closed' || view.kind === 'sign-in' || view.kind === 'no-workspace') {
    return <MemberGate kind={view.kind} closed={<Closed />} board="The Runners page" supabase={supabase} signinError={signinError} />;
  }
  if (view.kind === 'unreadable') {
    return <Notice title="Runners"><p className="ask-muted">The runners could not be read. Try again in a moment.</p></Notice>;
  }
  const runnerName = (id: string | null) => view.board.runners.find((runner) => runner.id === id)?.name ?? null;
  const jobs: TerminalJob[] = view.board.jobs.map((job) => ({ id: job.id, repo: job.repo, runner: runnerName(job.runner), status: job.status }));
  return (
    <TerminalProvider initial={terminalOf(terminal)} jobs={jobs}>
      <Board board={view.board} fleets={view.fleets} now={new Date(view.now)} />
    </TerminalProvider>
  );
}
