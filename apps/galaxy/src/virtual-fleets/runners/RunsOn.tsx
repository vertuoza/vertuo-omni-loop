import { TAB_WORDS, type FleetHead } from './runners-tab';
import './runners-tab.css';

// The fleet's head on every tab (PRD 3233 s4, screens 4.A to 4.E): the mission line, then the Runs on line, each runner linking to
// the Runners tab.

export function FleetHeadLines({ head, href }: { head: FleetHead; href: string }) {
  const { mission } = head;
  return (
    <div className="frt-head">
      {mission !== null && (
        <p className="frt-mission">
          <span>{mission.title}</span>
          {mission.merged !== null && <span className="ai-muted"> · {mission.merged}</span>}
          {mission.waits !== null && <span className="frt-waits"> · {mission.waits}</span>}
        </p>
      )}
      <p className="frt-runs">
        <span className="ai-muted">{TAB_WORDS.runsOn}</span>
        {head.runsOn.length === 0 ? <span className="ai-muted"> {head.none}</span> : head.runsOn.map((runner) => (
          <a key={runner.id} className="frt-chip" href={href}>
            <span className={`ai-dot is-${runner.tone}`} aria-hidden="true" />
            <span>{runner.name}</span>
            <span className="ai-muted"> {runner.words}</span>
          </a>
        ))}
      </p>
    </div>
  );
}
