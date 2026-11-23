'use client';
import { Select } from '@omni/ui';
import { useMemo, useState } from 'react';
import type { MissionLevel } from 'omni-loop/kit/lib/mission/brief.ts';
import { useRouter } from 'next/navigation';
import type { PrdNumber } from 'omni-loop/kit/lib/ids.ts';
import { MissionLevelSchema, type BugsPick, type ItemAnswer, type MissionAction, type StopAnswer } from '../missions.contract';
import { tokensOf } from '../token-words';
import { demoMissionsPort, httpMissionsPort, type MissionsPort } from './missions-tab.client';
import { ACTION_WORDS, LEVEL_WORDS, WORDS, type DailyView, type FleetPrds, type MissionsView, type NewMissionBox, type RequestLine, type StopView } from './missions-tab';
import { RepairDetail, StoppedBlock } from '../RepairParts';
import { RetroSection, StuckLine } from './RetroParts';
import './missions-tab.css';

// The Missions tab of a Virtual Fleet (PRD 2842 s7, the `mission-start` screen): each mission's goal, its
// status, its progress (`2 of 4 merged · 1 ready`), each PRD that waits for a person with what it waits on and
// its link, its brief linked; `Start` on a draft, `Pause` on a running or waiting mission, `Resume` on a paused
// one. The rules live in ./missions-tab.ts; this file draws them and makes the calls.

/** The busy and problem key of the fleet's own line, which belongs to no mission. */
const FLEET = 'fleet';
/** The busy and problem key of the New mission box. */
const NEW = 'new';

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
        <span className="mission-level-change">
          {WORDS.changeLevel}{' '}
          <Select
            size="sm"
            label={WORDS.changeLevel}
            value={level}
            disabled={disabled}
            onValueChange={(value) => {
              const picked = MissionLevelSchema.safeParse(value);
              if (picked.success) onChange(picked.data);
            }}
            options={levels.map((each) => ({ value: each, label: LEVEL_WORDS[each] }))}
          />
        </span>
      )}
    </p>
  );
}

/** A number field with its Save and Cancel, for a cap or a budget (PRD 3040): empty means none. */
function CapEditor({ label, initial, busy, onSave, onCancel }: { label: string; initial: number | null; busy: boolean; onSave: (tokens: number | null) => void; onCancel: () => void }) {
  const [text, setText] = useState(initial === null ? '' : String(initial));
  const parsed = tokensOf(text);
  return (
    <span className="mission-cap-editor">
      <label>{label}{' '}<input type="text" inputMode="numeric" value={text} disabled={busy} onChange={(event) => { setText(event.target.value); }} /></label>
      <button type="button" className="ask-button mission-action" data-primary="" disabled={busy || parsed === undefined} onClick={() => { if (parsed !== undefined) onSave(parsed); }}>{WORDS.save}</button>
      <button type="button" className="ask-button quiet mission-action" disabled={busy} onClick={onCancel}>{WORDS.cancel}</button>
    </span>
  );
}

/** `Tokens per day: No daily cap`, or `1.3M of 2M in the last 24 hours`, with `Change` for an owner (PRD 3040, `mission-start` 1.A). */
function DailyLine({ daily, busy, onSave }: { daily: DailyView; busy: boolean; onSave: (tokens: number | null) => void }) {
  const [editing, setEditing] = useState(false);
  return (
    <p className="mission-daily">
      <span>{WORDS.dailyCap}: {daily.words}{daily.window === null ? '' : ` ${daily.window}`}</span>
      {daily.canChange && !editing && <button type="button" className="ask-button quiet mission-action" disabled={busy} onClick={() => { setEditing(true); }}>{WORDS.change}</button>}
      {editing && <CapEditor label={WORDS.dailyCap} initial={daily.cap} busy={busy} onSave={(tokens) => { setEditing(false); onSave(tokens); }} onCancel={() => { setEditing(false); }} />}
    </p>
  );
}

/** `Raise the cap`, with the new number asked in place; an owner's alone (PRD 3040). */
function RaiseButton({ busy, onRaise }: { busy: boolean; onRaise: (tokens: number) => void }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState('');
  const parsed = tokensOf(text);
  if (!editing) return <button type="button" className="ask-button mission-action" data-primary="" disabled={busy} onClick={() => { setEditing(true); }}>{WORDS.raise}</button>;
  return (
    <span className="mission-cap-editor">
      <label>{WORDS.raiseTo}{' '}<input type="text" inputMode="numeric" value={text} disabled={busy} onChange={(event) => { setText(event.target.value); }} /></label>
      <button type="button" className="ask-button mission-action" data-primary="" disabled={busy || parsed === undefined || parsed === null} onClick={() => { if (parsed !== undefined && parsed !== null) onRaise(parsed); }}>{WORDS.save}</button>
    </span>
  );
}

/** `Paused: budget reached`, what was spent and whose cap, and the actions of the mission's own stop (PRD 3040, `mission-start` 1.B). */
function StopBlock({ stop, busy, onAnswer }: { stop: StopView; busy: boolean; onAnswer: (answer: StopAnswer, tokens?: number) => void }) {
  return (
    <div className="mission-stop" role="group" aria-label={stop.headline}>
      <strong>{stop.headline}</strong>
      <span className="ask-muted">{stop.detail}</span>
      {stop.actions.includes('raised') && stop.canRaise && <RaiseButton busy={busy} onRaise={(tokens) => { onAnswer('raised', tokens); }} />}
      {stop.actions.includes('stopped') && <button type="button" className="ask-button quiet mission-action" disabled={busy} onClick={() => { onAnswer('stopped'); }}>{WORDS.stopMission}</button>}
    </div>
  );
}

/** The fleet's cap reached, one notice above the list: `Resume tomorrow`, `Raise the cap` and `Stop the missions`, asked once (PRD 3040, `mission-start` 1.C). */
function FleetNotice({ notice, busy, onAnswer }: { notice: NonNullable<DailyView['notice']>; busy: boolean; onAnswer: (answer: StopAnswer, tokens?: number) => void }) {
  return (
    <div className="mission-stop mission-fleet-stop" role="group" aria-label={notice.headline}>
      <strong>{notice.headline}</strong>
      <span className="ask-muted">{notice.detail}</span>
      <button type="button" className="ask-button mission-action" data-primary="" disabled={busy} onClick={() => { onAnswer('tomorrow'); }}>{WORDS.tomorrow}</button>
      {notice.canRaise && <RaiseButton busy={busy} onRaise={(tokens) => { onAnswer('raised', tokens); }} />}
      <button type="button" className="ask-button quiet mission-action" disabled={busy} onClick={() => { onAnswer('stopped'); }}>{WORDS.stopMissions}</button>
    </div>
  );
}

/** `412k of 2M tokens`, or `No token budget`; on a draft, set for this mission alone (PRD 3040, AC-10). */
function BudgetLine({ budget, busy, onSave }: { budget: NonNullable<MissionsView['missions'][number]['budget']>; busy: boolean; onSave: (tokens: number | null) => void }) {
  const [editing, setEditing] = useState(false);
  return (
    <p className="mission-budget">
      <span>{budget.words}</span>
      {budget.canChange && !editing && <button type="button" className="ask-button quiet mission-action" disabled={busy} onClick={() => { setEditing(true); }}>{WORDS.change}<span className="ask-sr"> {WORDS.budgetFor}</span></button>}
      {editing && <CapEditor label={WORDS.budgetFor} initial={budget.tokens} busy={busy} onSave={(tokens) => { setEditing(false); onSave(tokens); }} onCancel={() => { setEditing(false); }} />}
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

/** The New mission box (PRD omni-loop-24, `mission-start` 1.A to 1.D): one goal, one Start; a person who may not sees it disabled, with why. */
function NewMission({ box, busy, problem, onStart }: { box: NewMissionBox; busy: boolean; problem: string | null; onStart: (goal: string) => Promise<boolean> }) {
  const [goal, setGoal] = useState('');
  const typed = goal.trim();
  return (
    <form
      className="mission-new"
      onSubmit={(event) => {
        event.preventDefault();
        if (typed === '' || !box.canStart) return;
        void onStart(typed).then((started) => { if (started) setGoal(''); });
      }}
    >
      <label htmlFor="new-mission-goal">{WORDS.newMission}</label>
      <div className="mission-new-row">
        <input id="new-mission-goal" type="text" value={goal} maxLength={300} disabled={busy || !box.canStart} onChange={(event) => { setGoal(event.target.value); }} />
        <button type="submit" className="ask-button mission-action" data-primary="" disabled={busy || !box.canStart || typed === ''}>{WORDS.start}</button>
      </div>
      <p className="ask-muted mission-new-hint">{WORDS.boxHint}</p>
      {box.refusal !== null && <p className="mission-problem" role="alert">{box.refusal}</p>}
      {problem !== null && <p className="mission-problem" role="alert">{problem}</p>}
    </form>
  );
}

/** A press of Start whose mission is not pushed yet: its goal as typed, and `Writing the mission`. */
function RequestItem({ request }: { request: RequestLine }) {
  return (
    <li className="mission" data-status="request">
      <div className="mission-body">
        <h3 className="mission-goal">{request.goal}</h3>
        <p className="mission-line"><span className="mission-state" data-status="running">{request.words}</span></p>
      </div>
    </li>
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

/** A mission's budget line, and the stop that paused it with its actions (PRD 3040). */
function BudgetParts({ mission, busy, onBudget, onAnswer }: { mission: MissionsView['missions'][number]; busy: boolean; onBudget: (tokens: number | null) => void; onAnswer: (stop: string, answer: StopAnswer, tokens?: number) => void }) {
  const stop = mission.stop;
  return (
    <>
      <BudgetLine budget={mission.budget} busy={busy} onSave={onBudget} />
      {stop !== null && <StopBlock stop={stop} busy={busy} onAnswer={(answer, tokens) => { onAnswer(stop.id, answer, tokens); }} />}
    </>
  );
}

/** A mission's status, its progress and its links: its brief, and Why when its PM wrote no PRD (PRD omni-loop-24). */
function MissionLine({ mission }: { mission: MissionsView['missions'][number] }) {
  return (
    <p className="mission-line">
      <span className="mission-state" data-status={mission.status}>{mission.statusWords}</span>
      <span className="mission-progress">{mission.progress}</span>
      {mission.noPrd !== null && <a href={mission.briefHref} title={mission.noPrd.why}>{WORDS.why}<span className="ask-sr">: {mission.noPrd.why}</span></a>}
      <a href={mission.briefHref}>{WORDS.brief}<span className="ask-sr">: {mission.title}</span></a>
    </p>
  );
}

/** One mission's row: its words at the left, its one button at the right. */
function MissionItem({ mission, demo, busy, problem, onMove, onLevel, onPick, onBudget, onAnswer, onStop, onItem }: {
  demo: boolean;
  mission: MissionsView['missions'][number];
  busy: string | null;
  problem: string | null;
  onMove: (action: MissionAction) => void;
  onLevel: (level: MissionLevel) => void;
  onPick: (prd: PrdNumber, pick: BugsPick) => void;
  onBudget: (tokens: number | null) => void;
  onAnswer: (stop: string, answer: StopAnswer, tokens?: number) => void;
  onStop: () => void;
  onItem: (item: string, answer: ItemAnswer) => void;
}) {
  const action = mission.action;
  return (
      <li className="mission" data-status={mission.status}>
        <div className="mission-body">
          <h3 className="mission-goal">{mission.goal}</h3>
          <MissionLine mission={mission} />
          <LevelLine
            words={mission.levelWords}
            level={mission.canChangeLevel ? mission.level : null}
            levels={mission.levels}
            disabled={busy !== null}
            onChange={onLevel}
          />
          <StuckLine stuck={mission.stuck} />
          <BudgetParts mission={mission} busy={busy !== null} onBudget={onBudget} onAnswer={onAnswer} />
          {mission.committeeOnly !== null && <p className="mission-committee-only ask-muted">{mission.committeeOnly}</p>}
          {mission.branch !== null && <BranchLine branch={mission.branch} />}
          {mission.trust !== null && <p className="mission-trust ask-muted">{mission.trust}</p>}
          {mission.fleetPrds !== null && <FleetPrdsLine fleet={mission.fleetPrds} />}
          <WaitList waits={mission.waits} titled={mission.level === 'alone'} busy={busy !== null} onPick={onPick} />
          <LimitWaits waits={mission.limitWaits} />
          <Repairs lines={mission.repairs} demo={demo} />
          <RetroSection mission={mission} busy={busy !== null} onResume={() => { onMove('resume'); }} onStop={onStop} onItem={onItem} />
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

  async function budget(mission: string, tokens: number | null) {
    setBusy(mission);
    setProblem(null);
    const done = await calls.setBudget(mission, tokens);
    setBusy(null);
    if (!done.ok) {
      setProblem({ mission, message: done.message });
      return;
    }
    router.refresh();
  }

  async function answer(mission: string, stop: string, choice: StopAnswer, tokens?: number) {
    setBusy(mission);
    setProblem(null);
    const done = await calls.answerStop(stop, choice, tokens);
    setBusy(null);
    if (!done.ok) {
      setProblem({ mission, message: done.message });
      return;
    }
    router.refresh();
  }

  async function stopStuck(mission: string) {
    setBusy(mission);
    setProblem(null);
    const done = await calls.stopStuck(mission);
    setBusy(null);
    if (!done.ok) {
      setProblem({ mission, message: done.message });
      return;
    }
    router.refresh();
  }

  async function answerItem(mission: string, item: string, choice: ItemAnswer) {
    setBusy(mission);
    setProblem(null);
    const done = await calls.answerItem(item, choice);
    setBusy(null);
    if (!done.ok) {
      setProblem({ mission, message: done.message });
      return;
    }
    router.refresh();
  }

  async function startMission(goal: string): Promise<boolean> {
    if (view.workspace === null) return false;
    setBusy(NEW);
    setProblem(null);
    const done = await calls.startMission(view.workspace, view.fleet, goal);
    setBusy(null);
    if (!done.ok) {
      setProblem({ mission: NEW, message: done.message });
      return false;
    }
    router.refresh();
    return true;
  }

  async function dailyCap(tokens: number | null) {
    if (view.workspace === null) return;
    setBusy(FLEET);
    setProblem(null);
    const done = await calls.setDailyCap(view.workspace, view.fleet, tokens);
    setBusy(null);
    if (!done.ok) {
      setProblem({ mission: FLEET, message: done.message });
      return;
    }
    router.refresh();
  }

  return (
    <section className="missions" data-screen="mission-start" aria-label={WORDS.tab}>
      {view.daily !== undefined && <DailyLine daily={view.daily} busy={busy !== null} onSave={(tokens) => { void dailyCap(tokens); }} />}
      {view.daily?.notice != null && <FleetNotice notice={view.daily.notice} busy={busy !== null} onAnswer={(choice, tokens) => { void answer(FLEET, view.daily?.notice?.id ?? '', choice, tokens); }} />}
      {problem?.mission === FLEET && <p className="mission-problem" role="alert">{problem.message}</p>}
      {view.box !== undefined && <NewMission box={view.box} busy={busy !== null} problem={problem?.mission === NEW ? problem.message : null} onStart={startMission} />}
      {view.missions.length === 0 && (view.requests ?? []).length === 0 && <p className="ask-muted missions-empty">{WORDS.empty}</p>}
      <ul className="missions-list">
        {(view.requests ?? []).map((request) => <RequestItem key={request.id} request={request} />)}
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
            onBudget={(tokens) => { void budget(mission.id, tokens); }}
            onAnswer={(stop, choice, tokens) => { void answer(mission.id, stop, choice, tokens); }}
            onStop={() => { void stopStuck(mission.id); }}
            onItem={(item, choice) => { void answerItem(mission.id, item, choice); }}
          />
        ))}
      </ul>
    </section>
  );
}
