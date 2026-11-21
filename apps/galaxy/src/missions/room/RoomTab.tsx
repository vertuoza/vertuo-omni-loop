'use client';
import { Select } from '@omni/ui';
import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { heroSvg } from '../../virtual-fleets/heroes/heroes';
import { decorative } from '../../people/face';
import { EVENT_ROLES, roleName, ROOM_WORDS, type EventRole, type RoomView } from './room';
import { RepairDetail, StoppedBlock } from '../RepairParts';
import './room.css';

// The Operation room of a Virtual Fleet (PRD 2842 s8, the `fleet-room` screen): one now line per hero, the
// clean-up line, and the ledger of the missions' events, newest first, filtered by role and by mission in the
// address. One motion: a row that arrives after the page is shown slides in at the top, once; never on load,
// and none under reduced motion (room.css). The page re-reads every 30 seconds while it is open.

const REFRESH_MS = 30_000;

export interface RoomTabProps {
  view: RoomView;
  /** The address's other parameters, kept by the filter form. */
  keep: Record<string, string>;
  /** Replaces the refresh, for the tests. */
  refresh?: () => void;
}

function Mark({ role, color }: { role: EventRole; color: string | null }) {
  if (role === 'supervisor') return <span className="room-mark room-mark-supervisor" aria-hidden="true">S</span>;
  return <span className="room-mark" aria-hidden="true" dangerouslySetInnerHTML={{ __html: decorative(heroSvg(role, color, '', 1)) }} />;
}

/** A hero whose PRD waits (PRD 2949): who, the headline, the account and its linked job, and the state chip. */
function WaitingNow({ line, wait }: { line: RoomView['now'][number]; wait: NonNullable<RoomView['now'][number]['wait']> }) {
  return (
    <span className="room-wait">
      <span className="room-hero">{line.heading}</span>
      <span className="room-doing">{wait.headline}.<small>{wait.lead}{wait.job === null ? null : <a href={wait.job.href}>{wait.job.label}</a>}{wait.tail}</small></span>
      <span className="room-state">{wait.chip}</span>
    </span>
  );
}

/** A hero whose PRD repairs or waits on an Omni Loop bug (PRD 2980): who, the headline, its cause and link, and the state chip. */
function RepairingNow({ line, repair }: { line: RoomView['now'][number]; repair: NonNullable<RoomView['now'][number]['repair']> }) {
  return (
    <span className="room-wait">
      <span className="room-hero">{line.heading}</span>
      <span className="room-doing">{repair.headline}<RepairDetail line={repair} /></span>
      <span className="room-state">{repair.chip}</span>
    </span>
  );
}

export function RoomTab({ view, keep, refresh }: RoomTabProps) {
  const router = useRouter();
  const seen = useRef<Set<string> | null>(null);
  const fresh = new Set<string>();
  if (seen.current !== null) for (const row of view.ledger) if (!seen.current.has(row.id)) fresh.add(row.id);
  useEffect(() => {
    seen.current = new Set(view.ledger.map((row) => row.id));
  }, [view.ledger]);
  useEffect(() => {
    const timer = setInterval(() => { (refresh ?? (() => { router.refresh(); }))(); }, REFRESH_MS);
    return () => { clearInterval(timer); };
  }, [router, refresh]);

  return (
    <section className="room" data-screen="fleet-room" aria-label={ROOM_WORDS.tab}>
      <div className="room-nowlines">
        <h2 className="room-title">{ROOM_WORDS.now}</h2>
        <ul className="room-nows">
          {view.now.map((line) => (
            <li key={line.id} data-state={line.state}>{line.repair !== undefined ? <RepairingNow line={line} repair={line.repair} /> : line.wait !== undefined ? <WaitingNow line={line} wait={line.wait} /> : line.state === 'working' ? line.words : <><span className="room-hero">{line.heading}</span>: {line.words}</>}</li>
          ))}
          {view.bugs.map((bug) => (
            <li key={`bug-${String(bug.issue)}`} data-state="bug">
              <span className="room-wait">
                <span className="room-hero">{roleName(bug.role)} · {ROOM_WORDS.agent}</span>
                <span className="room-doing">{bug.words}{bug.link !== null && <small><a href={bug.link}>{`Omni Loop bug #${String(bug.issue)}`}</a></small>}</span>
                <span className="room-state">{bug.chip}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>
      {view.stopped.map((line) => <StoppedBlock key={`${line.mission}:${String(line.prd)}`} line={line} demo={false} />)}
      <p className="room-cleanup"><span className="room-title">{ROOM_WORDS.cleanUp}</span> {view.cleanUp}</p>
      <div className="room-ledger">
        <h2 className="room-title">{ROOM_WORDS.ledger}</h2>
        <form className="room-filters" method="get">
          {Object.entries(keep).map(([name, value]) => <input key={name} type="hidden" name={name} value={value} />)}
          <div className="room-filter">{ROOM_WORDS.role}
            <Select
              size="sm"
              label={ROOM_WORDS.role}
              name="role"
              defaultValue={view.filter.role ?? ''}
              options={[{ value: '', label: ROOM_WORDS.anyRole }, ...EVENT_ROLES.map((role) => ({ value: role, label: roleName(role) }))]}
            />
          </div>
          <div className="room-filter">{ROOM_WORDS.mission}
            <Select
              size="sm"
              label={ROOM_WORDS.mission}
              name="mission"
              defaultValue={view.filter.mission ?? ''}
              options={[{ value: '', label: ROOM_WORDS.anyMission }, ...view.missions.map((mission) => ({ value: mission.id, label: mission.title }))]}
            />
          </div>
          <button type="submit" className="ask-button quiet">{ROOM_WORDS.show}</button>
        </form>
        {view.empty && <p className="ask-muted room-empty">{ROOM_WORDS.empty}</p>}
        {!view.empty && view.ledger.length === 0 && <p className="ask-muted room-empty">{ROOM_WORDS.noRows}</p>}
        <ol className="room-rows">
          {view.ledger.map((row) => (
            <li key={row.id} className={fresh.has(row.id) ? 'room-row room-new' : 'room-row'}>
              <time className="room-time">{row.time}</time>
              <span className="room-by"><Mark role={row.role} color={view.color} />{row.by}</span>
              <span className="room-sentence">{row.sentence}</span>
              {row.link !== null && <a className="room-link" href={row.link}>{row.linkLabel}</a>}
              <span className="room-state">{row.state}</span>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
