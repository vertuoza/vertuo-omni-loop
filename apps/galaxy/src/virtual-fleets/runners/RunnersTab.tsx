import { CopyCommand } from '../../roadmap/page/CopyCommand';
import { Refresh } from '../../runners/page/actions';
import { NeedHumanButton, NeedHumanProvider, type NeedJob } from '../../runners/page/NeedHuman';
import { TerminalButton, TerminalProvider, type TerminalJob } from '../../runners/page/Terminal';
import type { JobQuestions } from '../../runners/runners.contract';
import { repoName } from '../../runners/page/model';
import '../../runners/page/runners.css';
import type { FleetJobRow } from './runners-view';
import { RUNNERS_PATH, TAB_WORDS, type RunnersTab, type TabRunner } from './runners-tab';
import './runners-tab.css';

// An AI fleet's Runners tab (PRD 3233 s4, screens 4.A to 4.E): its own runners, the Shared runners running its work and the jobs
// waiting for a slot, each job with its role, PRD, status and time. `Answer` opens today's Need human drawer on a job waiting on the
// viewer; `Terminal` opens a runner's log over the page. The panels and the 5 s refresh run in the browser; the rest is drawn here.

export interface RunnersTabProps {
  tab: RunnersTab;
  /** The board's jobs, for the Terminal panel and the Need human drawer. */
  terminal: readonly TerminalJob[];
  need: readonly NeedJob[];
  /** The job `?terminal=` opens, and the one `?answer=` opens, once the board lists it. */
  openTerminal: string | null;
  openAnswer: string | null;
  /** The demo's questions, which the drawer reads and answers in the browser; null on a real page. */
  demo?: readonly JobQuestions[] | null;
}

function JobLine({ job }: { job: FleetJobRow }) {
  return (
    <li className="frt-job" id={`job-${job.id}`}>
      <span data-content>{job.roleWords ?? 'Job'}</span>
      <span data-content>
        {job.prd === null ? <code>{job.line}</code> : <><a href={job.prd.href}>PRD {job.prd.number}</a><span className="runners-muted"> · {job.prd.title}</span></>}
        {job.pr !== null && <> <a href={job.pr.href}>{job.pr.words}</a></>}
      </span>
      <span className={`runners-status is-${job.tone}${job.canAnswer ? ' is-human' : ''}`}>{job.status}</span>
      {job.reason !== null && <span className="frt-reason" data-content>{job.reason}</span>}
      {job.canAnswer && <NeedHumanButton job={job.id} />}
    </li>
  );
}

function RunnerCard({ item }: { item: TabRunner }) {
  const { row } = item;
  return (
    <li className="frt-runner">
      <div className="frt-runner-head">
        <span className="runners-name" data-content>{row.name}</span>
        {row.shared && <span className="runners-muted">{TAB_WORDS.sharedMark}</span>}
        <span className={`runners-state is-${row.tone}`}><i className="runners-dot" aria-hidden="true" />{row.stateWords}</span>
        <span data-content>{row.slotsWords}</span>
        {row.forFleetWords !== null && <span data-content>{row.forFleetWords}</span>}
        <span className="runners-repos" data-content title={row.repos.join(', ')}>{row.repos.map(repoName).join(' · ')}</span>
        <TerminalButton job={item.terminalJob} />
      </div>
      {row.reason !== null && <p className="frt-reason">{row.reason}</p>}
      {row.jobs.length > 0 && <ul className="frt-jobs">{row.jobs.map((job) => <JobLine key={job.id} job={job} />)}</ul>}
      {item.note !== null && <p className="runners-muted">{item.note}</p>}
    </li>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="frt-section"><h2>{title}</h2>{children}</section>;
}

function Body({ tab }: { tab: RunnersTab }) {
  return (
    <div className="frt-tab" data-screen="fleet-runners">
      {tab.emptyWords !== null && <p className="fleet-line">{tab.emptyWords}</p>}
      {tab.startCommand !== null && (
        <>
          <p className="runners-muted">{TAB_WORDS.startOne}</p>
          <CopyCommand command={tab.startCommand} id="frt-start-command" />
        </>
      )}
      {tab.tokens !== null && <p className="frt-tokens" role="status">{tab.tokens}</p>}
      {tab.own.length > 0 && <Section title={TAB_WORDS.own}><ul className="frt-list">{tab.own.map((item) => <RunnerCard key={item.row.id} item={item} />)}</ul></Section>}
      {tab.notes.map((note) => <p key={note} className="runners-muted">{note}</p>)}
      {tab.shared.length > 0 && <Section title={TAB_WORDS.shared}><ul className="frt-list">{tab.shared.map((item) => <RunnerCard key={item.row.id} item={item} />)}</ul></Section>}
      {tab.answers.length > 0 && <Section title={TAB_WORDS.answers}><ul className="frt-jobs">{tab.answers.map((job) => <JobLine key={job.id} job={job} />)}</ul></Section>}
      {tab.waiting.length > 0 && <Section title={TAB_WORDS.waiting}><ul className="frt-jobs">{tab.waiting.map((job) => <JobLine key={job.id} job={job} />)}</ul></Section>}
      <p className="runners-muted">{TAB_WORDS.giveIt}<a href={RUNNERS_PATH}>{TAB_WORDS.giveItLink}</a></p>
    </div>
  );
}

export function RunnersTabScreen({ tab, terminal, need, openTerminal, openAnswer, demo = null }: RunnersTabProps) {
  return (
    <TerminalProvider initial={openAnswer === null ? openTerminal : null} jobs={terminal}>
      <NeedHumanProvider initial={openAnswer} jobs={need} demo={demo}>
        <Body tab={tab} />
      </NeedHumanProvider>
      {demo === null && <Refresh />}
    </TerminalProvider>
  );
}
