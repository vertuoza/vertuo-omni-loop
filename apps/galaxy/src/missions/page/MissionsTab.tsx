'use client';
import { useMemo, useState } from 'react';
import type { MissionLevel } from 'omni-loop/kit/lib/mission/brief.ts';
import { useRouter } from 'next/navigation';
import type { PrdNumber } from 'omni-loop/kit/lib/ids.ts';
import { MissionLevelSchema, type BugsPick, type MissionAction } from '../missions.contract';
import { demoMissionsPort, httpMissionsPort, type MissionsPort } from './missions-tab.client';
import { ACTION_WORDS, LEVEL_WORDS, WORDS, type FleetPrds, type MissionsView } from './missions-tab';
import { RepairDetail, StoppedBlock } from '../RepairParts';
import './missions-tab.css';

// The Missions tab of a Virtual Fleet (PRD 2842 s7, the `mission-start` screen): each mission's goal, its
// status, its progress (`2 of 4 merged · 1 ready`), each PRD that waits for a person with what it waits on and
// its link, its brief linked; `Start` on a draft, `Pause` on a running or waiting mission, `Resume` on a paused
// one. The rules live in ./missions-tab.ts; this file draws them and makes the calls.

export interface MissionsTabProps {
  view: MissionsView;
  /** Replaces the calls, for the tests. */
  port?: MissionsPort;
}

/** `Level: Own branch`, and on a draft the choice that changes it for this mission alone (`level` null: no choice). */
function LevelLine({ words, level, levels, disabled, onChange }: { words: string; level: MissionLevel | null; levels: readonly MissionLevel[]; disabled: boolean; onChange: (level: MissionLevel) => void }) {
  return (
    <p className="mission-level">
      <span>{WORDS.level}: {words}</span>
      {level !== null && (
        <label className="mission-level-change">
          {WORDS.changeLevel}{' '}
          <select
            value={level}
            disabled={disabled}
            onChange={(event) => {
              const picked = MissionLevelSchema.safeParse(event.target.value);
              if (picked.success) onChange(picked.data);
            }}
          >
            {levels.map((each) => <option key={each} value={each}>{LEVEL_WORDS[each]}</option>)}
          </select>
        </label>
      )}
    </p>
  );
}

/** `Branch: PRD 3 · up to date`, the mission pull request's link and, when the branch waits on a person, why. */
function BranchLine({ branch }: { branch: NonNullable<MissionsView['missions'][number]['branch']> }) {
  return (
    <p className="mission-branch">
      <span>{WORDS.branch}: {branch.words}</span>
      {branch.pullHref !== null && <a href={branch.pullHref}>{WORDS.pull}</a>}
      {branch.hold !== null && <span className="mission-branch-hold">{branch.hold}</span>}
    </p>
  );
}

/** Each PRD the mission waits on, linked, with what it waits on. */
function WaitList({ waits, titled, busy, onPick }: { waits: MissionsView['missions'][number]['waits']; titled: boolean; busy: boolean; onPick: (prd: PrdNumber, pick: BugsPick) => void }) {
  if (waits.length === 0) return null;
  return (
    <ul className="mission-waits" {...(titled ? { 'aria-label': WORDS.waitingOnYou } : {})}>
      {titled && <li className="mission-waits-title"><strong>{WORDS.waitingOnYou}</strong></li>}
      {waits.map((wait) => (
        <li key={wait.prd}>
          <a href={wait.href}>PRD {wait.prd}</a>: {wait.bugs === null ? wait.on : <DecideBugs wait={wait} bugs={wait.bugs} busy={busy} onPick={onPick} />}
        </li>
      ))}
    </ul>
  );
}

/** A PRD on `Decide the bugs` (PRD 3001, `fleet-room` 1.A and 1.B): QA's bugs still there, by issue, and the two actions. */
function DecideBugs({ wait, bugs, busy, onPick }: { wait: MissionsView['missions'][number]['waits'][number]; bugs: NonNullable<MissionsView['missions'][number]['waits'][number]['bugs']>; busy: boolean; onPick: (prd: PrdNumber, pick: BugsPick) => void }) {
  return (
    <span className="mission-decide-bugs">
      {WORDS.decideBugs}
      <ul className="mission-bugs">
        {bugs.map((bug) => <li key={bug.issue}><a href={bug.href}>#{bug.issue}</a></li>)}
      </ul>
      <button type="button" className="ask-button mission-action" data-primary="" disabled={busy} onClick={() => { onPick(wait.prd, 'review'); }}>{WORDS.sendOn}</button>
      <button type="button" className="ask-button quiet mission-action" disabled={busy} onClick={() => { onPick(wait.prd, 'stop'); }}>{WORDS.stopPrd}</button>
    </span>
  );
}

/** Each PRD that waits out a provider limit or for room (PRD 2949): the line the room shows, the account and its linked job. */
function LimitWaits({ waits }: { waits: MissionsView['missions'][number]['limitWaits'] }) {
  if (waits.length === 0) return null;
  return (
    <ul className="mission-limit-waits">
      {waits.map((wait) => (
        <li key={wait.prd}>
          PRD {wait.prd}: {wait.headline}.
          <small className="ask-muted"> {wait.lead}{wait.job === null ? null : <a href={wait.job.href}>{wait.job.label}</a>}{wait.tail}</small>
        </li>
      ))}
    </ul>
  );
}

/** Each PRD that repairs or waits on an Omni Loop bug (PRD 2980), then the Stopped block of each that stopped after repairs. */
function Repairs({ lines, demo }: { lines: MissionsView['missions'][number]['repairs']; demo: boolean }) {
  const going = lines.filter((line) => line.kind !== 'stopped');
  return (
    <>
      {going.length > 0 && (
        <ul className="mission-limit-waits">
          {going.map((line) => <li key={line.prd}>PRD {line.prd}: {line.headline}.<RepairDetail line={line} /></li>)}
        </ul>
      )}
      {lines.filter((line) => line.kind === 'stopped').map((line) => <StoppedBlock key={line.prd} line={line} demo={demo} />)}
    </>
  );
}

/** What the fleet's PM added to the mission, then each row its cap left unwritten (PRD 2896 s12). */
function FleetPrdsLine({ fleet }: { fleet: FleetPrds }) {
  return (
    <>
      {fleet.words !== null && <p className="mission-fleet-prds ask-muted">{fleet.words}</p>}
      {fleet.notWritten.length > 0 && (
        <ul className="mission-not-written">
          {fleet.notWritten.map((line) => <li key={line} className="ask-muted">{line}</li>)}
        </ul>
      )}
    </>
  );
}

/** The one move a status allows: `Start` is the primary action of a draft. */
function ActionButton({ action, title, busy, disabled, onMove }: { action: MissionAction; title: string; busy: boolean; disabled: boolean; onMove: (action: MissionAction) => void }) {
  return (
    <button
      type="button"
      className={action === 'start' ? 'ask-button mission-action' : 'ask-button quiet mission-action'}
      {...(action === 'start' ? { 'data-primary': '' } : {})}
      disabled={disabled}
      onClick={() => { onMove(action); }}
    >
      {busy ? ACTION_WORDS[action].busy : ACTION_WORDS[action].idle}
      <span className="ask-sr"> {title}</span>
    </button>
  );
}

/** One mission's row: its words at the left, its one button at the right. */
function MissionItem({ mission, demo, busy, problem, onMove, onLevel, onPick }: {
  demo: boolean;
  mission: MissionsView['missions'][number];
  busy: string | null;
  problem: string | null;
  onMove: (action: MissionAction) => void;
  onLevel: (level: MissionLevel) => void;
  onPick: (prd: PrdNumber, pick: BugsPick) => void;
}) {
  const action = mission.action;
  return (
      <li className="mission" data-status={mission.status}>
        <div className="mission-body">
          <h3 className="mission-goal">{mission.goal}</h3>
          <p className="mission-line">
            <span className="mission-state" data-status={mission.status}>{mission.statusWords}</span>
            <span className="mission-progress">{mission.progress}</span>
            <a href={mission.briefHref}>{WORDS.brief}<span className="ask-sr">: {mission.title}</span></a>
          </p>
          <LevelLine
            words={mission.levelWords}
            level={mission.canChangeLevel ? mission.level : null}
            levels={mission.levels}
            disabled={busy !== null}
            onChange={onLevel}
          />
          {mission.committeeOnly !== null && <p className="mission-committee-only ask-muted">{mission.committeeOnly}</p>}
          {mission.branch !== null && <BranchLine branch={mission.branch} />}
          {mission.trust !== null && <p className="mission-trust ask-muted">{mission.trust}</p>}
          {mission.fleetPrds !== null && <FleetPrdsLine fleet={mission.fleetPrds} />}
          <WaitList waits={mission.waits} titled={mission.level === 'alone'} busy={busy !== null} onPick={onPick} />
          <LimitWaits waits={mission.limitWaits} />
          <Repairs lines={mission.repairs} demo={demo} />
          {mission.stopped !== null && <p className="mission-stopped ask-muted">{mission.stopped}</p>}
          {problem !== null && <p className="mission-problem" role="alert">{problem}</p>}
        </div>
        {action !== null && <ActionButton action={action} title={mission.title} busy={busy === mission.id} disabled={busy !== null} onMove={onMove} />}
      </li>
  );
}

export function MissionsTab({ view, port }: MissionsTabProps) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [problem, setProblem] = useState<{ mission: string; message: string } | null>(null);
  const calls = useMemo(() => port ?? (view.workspace === null ? demoMissionsPort : httpMissionsPort()), [port, view.workspace]);

  async function move(mission: string, action: MissionAction) {
    setBusy(mission);
    setProblem(null);
    const done = await calls.move(mission, action);
    setBusy(null);
    if (!done.ok) {
      setProblem({ mission, message: done.message });
      return;
    }
    router.refresh();
  }

  async function changeLevel(mission: string, level: MissionLevel) {
    setBusy(mission);
    setProblem(null);
    const done = await calls.setLevel(mission, level);
    setBusy(null);
    if (!done.ok) {
      setProblem({ mission, message: done.message });
      return;
    }
    router.refresh();
  }

  async function pick(mission: string, prd: PrdNumber, choice: BugsPick) {
    setBusy(mission);
    setProblem(null);
    const done = await calls.pickBugs(mission, prd, choice);
    setBusy(null);
    if (!done.ok) {
      setProblem({ mission, message: done.message });
      return;
    }
    router.refresh();
  }

  return (
    <section className="missions" data-screen="mission-start" aria-label={WORDS.tab}>
      {view.missions.length === 0 && <p className="ask-muted missions-empty">{WORDS.empty}</p>}
      <ul className="missions-list">
        {view.missions.map((mission) => (
          <MissionItem
            key={mission.id}
            mission={mission}
            demo={view.workspace === null}
            busy={busy}
            problem={problem?.mission === mission.id ? problem.message : null}
            onMove={(action) => { void move(mission.id, action); }}
            onLevel={(level) => { void changeLevel(mission.id, level); }}
            onPick={(prd, choice) => { void pick(mission.id, prd, choice); }}
          />
        ))}
      </ul>
    </section>
  );
}
