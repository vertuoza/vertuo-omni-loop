import { Notice } from '../../ask/page/Notice';
import { MemberGate } from '../../dashboard/MemberGate';
import { CopyCommand } from '../../roadmap/page/CopyCommand';
import type { Board, Job, Runner } from '../runners.contract';
import { CancelButton, FixWithAnswersButton, FleetPicker, Refresh, ResumeButton, SendAgainButton } from './actions';
import {
  afterAnswersWords, answeredOf, cancelledByWords, canAnswer, canCancel, canResume, canSendAgain, cannotRunReason, fixLineOf, fleetCell, madeByWords, prdLineOf, prdPageLink, prWords, releaseNotes, repoName, retroLineOf, senderWords, slicesWords, START_COMMAND, stateWords, statusTone, statusWords, targetOf, whereWords,
  type Answered, type Fleet, type PrdTitles, type ReleaseNote, type RetroPrds, type RunnersPageView,
} from './model';
import { accountChips, asOfWords, gaugesOf, jobTokensWords, OLD_RUNNER_WORDS, stateTone, UPDATE_COMMAND, waitingWords, type Gauge } from './health';
import { listedAnswer } from './need-human';
import { NeedHumanButton, NeedHumanProvider, type NeedJob } from './NeedHuman';
import { jobAgentWords, partLines } from './parts';
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
// the server, so a refresh draws it again with the new rows, the open panel kept. A job whose runner
// released its claims once it ended lists them under its status, each linked, or says why it could not
// (PRD 2175). A done job that ended with questions open reads Need human, filled, with a Need human button
// opening the drawer that answers them (PRD 2255 s3, ./NeedHuman.tsx); `?answer=<job id>` opens it too. Once
// answered or dismissed it reads Done and carries no button. A job that waited on answers reads Answered ·
// fixing and Answered · fixed once they are in, linking the fix job, which reads `after answers · job <id>`
// linking back; with every asked item answered and no fix queued it reads Answered with Fix with answers,
// the row's one primary action (PRD 2270 s2). A job an API key sent names the key as its sender, with `made by
// @<login>` under it and ` · for <acting_for>` when the app said whom it acted for; a job a key cancelled reads
// Cancelled with `by API key <name>` under it (PRD 2425 s5). A bug fix's own end reads Done, as it did.

type Supabase = { url: string; key: string };

export interface RunnersPageProps {
  view: RunnersPageView;
  supabase: Supabase | null;
  signinError: string | null;
  /** The job whose Terminal panel the URL opens (`?terminal=<job id>`), if any. */
  terminal?: string | null;
  /** The job whose Need human drawer the URL opens (`?answer=<job id>`), if any (PRD 2255). */
  answer?: string | null;
}

function Closed() {
  return (
    <Notice title="The Runners page is not open here">
      <p className="ask-muted">This deployment has no database, so it has no runners to show.</p>
    </Notice>
  );
}

function GaugeView({ gauge }: { gauge: Gauge }) {
  return (
    <div className={`runners-gauge${gauge.over ? ' is-over' : ''}`} data-gauge={gauge.key}>
      <div className="runners-gauge-k">{gauge.label}</div>
      <div className="runners-gauge-v" data-content {...(gauge.title === null ? {} : { title: gauge.title })}>{gauge.value}</div>
      {gauge.fill !== null && <div className="runners-gauge-fill"><i style={{ width: `${String(Math.round(gauge.fill))}%` }} /></div>}
      {gauge.spark !== null && (
        <svg viewBox="0 0 100 18" preserveAspectRatio="none" aria-hidden="true"><polyline points={gauge.spark} /></svg>
      )}
    </div>
  );
}

/** A runner's accounts under its gauges (PRD 2537): one chip each in the file's order, its state in its colour. */
function AccountChips({ runner }: { runner: Runner }) {
  const chips = accountChips(runner);
  if (chips.length === 0) return null;
  return (
    <div className="runners-accounts">
      {chips.map((chip) => <span key={chip.id} className={`runners-chip is-${chip.tone}`} title={chip.title} data-content>{chip.id}</span>)}
    </div>
  );
}

function HealthLine({ runner, now }: { runner: Runner; now: Date }) {
  const gauges = gaugesOf(runner);
  if (gauges === null) {
    return (
      <div className="runners-health runners-old">
        <p className="runners-muted">{OLD_RUNNER_WORDS}</p>
        <CopyCommand command={UPDATE_COMMAND} id={`runners-update-${runner.id}`} />
      </div>
    );
  }
  const asOf = asOfWords(runner, now);
  return (
    <div className={`runners-health${asOf === null ? '' : ' is-grey'}`}>
      {gauges.map((gauge) => <GaugeView key={gauge.key} gauge={gauge} />)}
      {asOf !== null && <span className="runners-asof">{asOf}</span>}
      <AccountChips runner={runner} />
    </div>
  );
}

function RunnerRow({ runner, board, fleets, now }: { runner: Runner; board: Board; fleets: readonly Fleet[]; now: Date }) {
  const fleet = fleetCell(runner, board.viewer, fleets);
  return (
    <div className="runners-row">
      <span className="runners-name" data-content>{runner.name}</span>
      <span className={`runners-state is-${stateTone(runner)}`}><i className="runners-dot" aria-hidden="true" />{stateWords(runner, now)}</span>
      {fleet.kind === 'picker'
        ? <FleetPicker runner={runner.id} name={runner.name} value={fleet.value} options={fleet.options} />
        : <span data-content>{fleet.label}</span>}
      <span data-content>{runner.used} of {runner.slots}</span>
      <span className="runners-repos" data-content title={runner.repos.join(', ')}>{runner.repos.map(repoName).join(' · ')}</span>
      <span className="runners-muted" data-content>{runner.version}</span>
      <TerminalButton job={runnerJob(runner, board.jobs)?.id ?? null} />
      <HealthLine runner={runner} now={now} />
    </div>
  );
}

/** A done job's button about its answers: Fix with answers once they are in (PRD 2270), Need human while its questions are open (PRD 2255). */
function AnswersButton({ job, primary, answered }: { job: Job; primary: boolean; answered: Answered | null }) {
  if (answered?.button === true && fixLineOf(job) !== null) return <FixWithAnswersButton job={job.id} primary={primary} />;
  return canAnswer(job) ? <NeedHumanButton job={job.id} /> : null;
}

function Action({ job, primary, answered }: { job: Job; primary: boolean; answered: Answered | null }) {
  if (canCancel(job)) return <CancelButton job={job.id} />;
  if (canSendAgain(job)) return <SendAgainButton line={job.line} repo={job.repo} target={targetOf(job)} primary={primary} />;
  const page = prdPageLink(job);
  return (
    <>
      <AnswersButton job={job} primary={primary} answered={answered} />
      {canResume(job) && <ResumeButton line={job.line} repo={job.repo} target={targetOf(job)} primary={primary} />}
      {job.status === 'done' && job.prUrl && <a href={job.prUrl}>{prWords(job.prUrl)}</a>}
      {page !== null && <a href={page}>PRD page</a>}
    </>
  );
}

/** One line under a job's status about its claims: the sub-PRs released, each linked, or why the release failed. */
function ReleaseLine({ note }: { note: ReleaseNote }) {
  if (note.kind === 'failed') return <span className="runners-why" data-content>{note.text}</span>;
  return (
    <span className="runners-why">
      Released{' '}
      {note.prs.map((pr, i) => (
        <span key={pr.number}>{i > 0 && ', '}<a href={pr.url} data-content>#{pr.number}</a></span>
      ))}
    </span>
  );
}

/** A job's status: its words, or Answered · fixing / fixed linking the fix, or Answered (PRD 2270). */
function StatusWords({ job, now, answered, cannotRun }: { job: Job; now: Date; answered: Answered | null; cannotRun: boolean }) {
  const words = answered === null ? statusWords(job, now, cannotRun) : answered.fix === null ? answered.words : <a href={`#job-${answered.fix}`}>{answered.words}</a>;
  return <span className={`runners-status is-${answered?.tone ?? statusTone(job.status, job.outcome, cannotRun)}${canAnswer(job) ? ' is-human' : ''}`}>{words}</span>;
}

/** Under Cancelled, which API key cancelled the job (PRD 2425); nothing for any other job. */
function CancelledBy({ job }: { job: Job }) {
  const words = cancelledByWords(job);
  return words === null ? null : <span className="runners-by" data-content>{words}</span>;
}

/** Under Cannot run, why no runner can take the job (PRD 2482); nothing for any other job. */
function CannotRunWhy({ reason }: { reason: string | null }) {
  return reason === null ? null : <span className="runners-why" data-content>{reason}</span>;
}

/** Under a job that turned over to another account, one line per part (PRD 2537); nothing for a job that ran on one. */
function Parts({ job }: { job: Job }) {
  const lines = partLines(job);
  if (lines.length === 0) return null;
  return <span className="runners-parts">{lines.map((line, at) => <span key={at} className="runners-part" title={line.title ?? undefined} data-content>{line.text}</span>)}</span>;
}

/** Beside a job's status, its tokens (PRD 2102) and the agent and model it runs on, then its parts (PRD 2537); each once its runner reported it. */
function RunWords({ job }: { job: Job }) {
  const tokens = jobTokensWords(job);
  const agent = jobAgentWords(job);
  return (
    <>
      {tokens !== null && <span className="runners-tokens" title={tokens.title}>{tokens.text}</span>}
      {agent !== null && <span className="runners-agent" data-content>{agent}</span>}
      <Parts job={job} />
    </>
  );
}

/** Under Queued, why the runners that could take the job are paused (PRD 2102); nothing for any other job. */
function WaitingWhy({ words }: { words: string | null }) {
  return words === null ? null : <span className="runners-why">{words}</span>;
}

function JobRow({ job, board, fleets, prds, retros, now, primary, answeredIds }: { job: Job; board: Board; fleets: readonly Fleet[]; prds: PrdTitles; retros: RetroPrds; now: Date; primary: boolean; answeredIds: readonly string[] }) {
  const cannotRun = cannotRunReason(job, board.runners, fleets);
  const waiting = cannotRun === null ? waitingWords(job, board.runners) : null;
  const prd = prdLineOf(job, prds);
  const retro = retroLineOf(job, retros);
  const answered = answeredOf(job, board.jobs, answeredIds);
  const after = afterAnswersWords(job);
  return (
    <div className="runners-row runners-job" id={`job-${job.id}`}>
      <span className="runners-line">
        <code data-content>{job.line}</code>
        {prd !== null && <span className="runners-prd"><a href={prd.href}>PRD {prd.number}</a><span className="runners-muted" data-content> · {prd.title}</span></span>}
      </span>
      <span className="runners-muted" data-content title={job.repo}>{repoName(job.repo)}</span>
      <span data-content>{senderWords(job)}{madeByWords(job) !== null && <small className="runners-muted runners-made-by"> {madeByWords(job)}</small>}{retro !== null && <small className="runners-muted runners-made-by"> <a href={retro.href}>{retro.words}</a></small>}</span>
      <span data-content>{whereWords(job, board.runners, fleets)}</span>
      <span>
        <StatusWords job={job} now={now} answered={answered} cannotRun={cannotRun !== null} />
        <CannotRunWhy reason={cannotRun} />
        <CancelledBy job={job} />
        {after !== null && job.continues && <span className="runners-why"><a href={`#job-${job.continues}`} data-content>{after}</a></span>}
        {slicesWords(job) !== null && <span className="runners-why" data-content>{slicesWords(job)}</span>}
        <RunWords job={job} />
        <WaitingWhy words={waiting} />
        {releaseNotes(job).map((note) => <ReleaseLine key={note.kind} note={note} />)}
      </span>
      <span className="runners-actions"><TerminalButton job={job.id} /><Action job={job} primary={primary} answered={answered} /></span>
    </div>
  );
}

function Jobs({ board, fleets, prds, retros, now, answered }: { board: Board; fleets: readonly Fleet[]; prds: PrdTitles; retros: RetroPrds; now: Date; answered: readonly string[] }) {
  if (board.jobs.length === 0) return <p className="runners-muted">No job yet.</p>;
  const primary = (board.jobs.find(canResume) ?? board.jobs.find(canSendAgain))?.id ?? answered[0] ?? null;
  return (
    <div className="runners-table runners-jobs">
      <div className="runners-row runners-head"><span>Line</span><span>Repository</span><span>Sent by</span><span>Where</span><span>Status</span><span /></div>
      {board.jobs.map((job) => <JobRow key={job.id} job={job} board={board} fleets={fleets} prds={prds} retros={retros} now={now} primary={job.id === primary} answeredIds={answered} />)}
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

function Board({ board, fleets, prds, retros, now, answered }: { board: Board; fleets: readonly Fleet[]; prds: PrdTitles; retros: RetroPrds; now: Date; answered: readonly string[] }) {
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
            <Jobs board={board} fleets={fleets} prds={prds} retros={retros} now={now} answered={answered} />
          </section>
        </>
      )}
      <Refresh />
    </div>
  );
}

export function RunnersPage({ view, supabase, signinError, terminal = null, answer = null }: RunnersPageProps) {
  if (view.kind === 'closed' || view.kind === 'sign-in' || view.kind === 'no-workspace') {
    return <MemberGate kind={view.kind} closed={<Closed />} board="The Runners page" supabase={supabase} signinError={signinError} />;
  }
  if (view.kind === 'unreadable') {
    return <Notice title="Runners"><p className="ask-muted">The runners could not be read. Try again in a moment.</p></Notice>;
  }
  const runnerName = (id: string | null) => view.board.runners.find((runner) => runner.id === id)?.name ?? null;
  const jobs: TerminalJob[] = view.board.jobs.map((job) => ({ id: job.id, repo: job.repo, runner: runnerName(job.runner), status: job.status }));
  // The job `?answer=` opens, once the board lists it; with it, the Terminal panel stays shut, so two panels never stack.
  const asked = listedAnswer(answer, view.board.jobs);
  const needJobs: NeedJob[] = view.board.jobs.map((job) => ({ id: job.id, repo: job.repo }));
  return (
    <TerminalProvider initial={terminalOf(asked === null ? terminal : null)} jobs={jobs}>
      <NeedHumanProvider initial={asked} jobs={needJobs} demo={view.demoQuestions ?? null}>
        <Board board={view.board} fleets={view.fleets} prds={view.prds} retros={view.retros ?? {}} now={new Date(view.now)} answered={view.answered} />
      </NeedHumanProvider>
    </TerminalProvider>
  );
}
