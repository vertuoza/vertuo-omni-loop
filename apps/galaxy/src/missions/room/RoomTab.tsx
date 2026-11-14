'use client';
import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { heroSvg } from '../../virtual-fleets/heroes/heroes';
import { decorative } from '../../people/face';
import { EVENT_ROLES, roleName, ROOM_WORDS, type EventRole, type RoomView } from './room';
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
            <li key={line.id} data-state={line.state}>{line.state === 'working' ? line.words : <><span className="room-hero">{line.heading}</span>: {line.words}</>}</li>
          ))}
        </ul>
      </div>
      <p className="room-cleanup"><span className="room-title">{ROOM_WORDS.cleanUp}</span> {view.cleanUp}</p>
      <div className="room-ledger">
        <h2 className="room-title">{ROOM_WORDS.ledger}</h2>
        <form className="room-filters" method="get">
          {Object.entries(keep).map(([name, value]) => <input key={name} type="hidden" name={name} value={value} />)}
          <label>{ROOM_WORDS.role}
            <select name="role" defaultValue={view.filter.role ?? ''}>
              <option value="">{ROOM_WORDS.anyRole}</option>
              {EVENT_ROLES.map((role) => <option key={role} value={role}>{roleName(role)}</option>)}
            </select>
          </label>
          <label>{ROOM_WORDS.mission}
            <select name="mission" defaultValue={view.filter.mission ?? ''}>
              <option value="">{ROOM_WORDS.anyMission}</option>
              {view.missions.map((mission) => <option key={mission.id} value={mission.id}>{mission.title}</option>)}
            </select>
          </label>
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
              {row.link !== null && <a className="room-link" href={row.link}>{row.prd === null ? 'Open' : `PRD ${String(row.prd)}`}</a>}
              <span className="room-state">{row.state}</span>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
