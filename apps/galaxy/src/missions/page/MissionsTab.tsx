'use client';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { MissionAction } from '../missions.contract';
import { demoMissionsPort, httpMissionsPort, type MissionsPort } from './missions-tab.client';
import { ACTION_WORDS, WORDS, type MissionsView } from './missions-tab';
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

  return (
    <section className="missions" data-screen="mission-start" aria-label={WORDS.tab}>
      {view.missions.length === 0 && <p className="ask-muted missions-empty">{WORDS.empty}</p>}
      <ul className="missions-list">
        {view.missions.map((mission) => (
          <li className="mission" key={mission.id} data-status={mission.status}>
            <div className="mission-body">
              <h3 className="mission-goal">{mission.goal}</h3>
              <p className="mission-line">
                <span className="mission-state" data-status={mission.status}>{mission.statusWords}</span>
                <span className="mission-progress">{mission.progress}</span>
                <a href={mission.briefHref}>{WORDS.brief}<span className="ask-sr">: {mission.title}</span></a>
              </p>
              {mission.waits.length > 0 && (
                <ul className="mission-waits">
                  {mission.waits.map((wait) => (
                    <li key={wait.prd}><a href={wait.href}>PRD {wait.prd}</a>: {wait.on}</li>
                  ))}
                </ul>
              )}
              {mission.stopped !== null && <p className="mission-stopped ask-muted">{mission.stopped}</p>}
              {problem?.mission === mission.id && <p className="mission-problem" role="alert">{problem.message}</p>}
            </div>
            {mission.action !== null && (
              <button
                type="button"
                className={mission.action === 'start' ? 'ask-button mission-action' : 'ask-button quiet mission-action'}
                {...(mission.action === 'start' ? { 'data-primary': '' } : {})}
                disabled={busy !== null}
                onClick={() => { void move(mission.id, mission.action ?? 'start'); }}
              >
                {busy === mission.id ? ACTION_WORDS[mission.action].busy : ACTION_WORDS[mission.action].idle}
                <span className="ask-sr"> {mission.title}</span>
              </button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
