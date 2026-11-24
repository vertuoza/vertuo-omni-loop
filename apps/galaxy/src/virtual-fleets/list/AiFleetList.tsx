import { Table } from '@omni/ui';
import { FleetChip } from '../../people/FleetChip';
import { NewVirtualFleet } from '../drawer/NewVirtualFleet';
import { PLAYERS_FLEET_PATH } from '../../dashboard/fleet/redirect';
import { LIST_WORDS, type AiFleetList as ListView, type AiFleetRow } from './list';
import './list.css';

// The AI Fleet list (PRD 3233 s3, screens 2.A and 2.B of the before/after page): the title, `<k> of <n> fleets wait on you`, the
// New AI fleet button, one row per AI fleet (fleet, mission, waits on you, runs on, Open), and a link to the players' fleets.
// With no AI fleet, the empty line and the button as its main action.

/** What the New AI fleet button needs: the workspace it makes the fleet in (null in the demo), the mascots, the owner flag. */
export interface NewFleetProps {
  workspace: string | null;
  mascots: readonly string[];
  owner?: boolean;
}

function RunsOn({ row }: { row: AiFleetRow }) {
  return (
    <>
      <ul className="ai-runs">
        {row.runsOn.map((runner) => (
          <li key={runner.id}>
            <span className={`ai-dot is-${runner.tone}`} aria-hidden="true" />
            <span>{runner.name}</span>
            <span className="ai-muted"> {runner.words}</span>
            {runner.shared && <span className="ai-shared"> {LIST_WORDS.shared}{runner.forFleet === null ? '' : ` · ${runner.forFleet}`}</span>}
          </li>
        ))}
      </ul>
      {row.warning !== null && <p className="ai-warning">{row.warning}</p>}
    </>
  );
}

const COLUMNS = [
  { id: 'fleet', label: 'AI fleet' }, { id: 'mission', label: 'Mission' }, { id: 'waits', label: 'Waits on you' }, { id: 'runs', label: 'Runs on' }, { id: 'open', label: <span className="ask-sr">Open</span> },
];

const rowOf = (row: AiFleetRow) => ({
  id: row.name,
  cells: {
    fleet: (
      <div className="ai-cell">
        <FleetChip fleet={row.tag} link={false} />
        <p className="ai-muted">{row.heroes.join(' · ')}</p>
      </div>
    ),
    mission: (
      <div className="ai-cell">
        {row.mission.title !== null && <p>{row.mission.title}</p>}
        <p className={row.mission.kind === 'none' ? 'ai-muted' : undefined}>{row.mission.line}</p>
      </div>
    ),
    waits: <span className={row.waitCount === 0 ? 'ai-muted' : undefined}>{row.waits}</span>,
    runs: <RunsOn row={row} />,
    open: <a href={row.href}>{LIST_WORDS.open}</a>,
  },
});

export function AiFleetListScreen({ view, make }: { view: ListView; make: NewFleetProps | null }) {
  const button = make ? <NewVirtualFleet workspace={make.workspace} mascots={make.mascots} owner={make.owner === true} primary={view.fleets.length === 0} /> : null;
  return (
    <div className="dash" data-screen="ai-fleet">
      <h1 className="dash-name">{LIST_WORDS.title}</h1>
      {view.fleets.length === 0 ? (
        <>
          <p className="fleet-line">{LIST_WORDS.empty}</p>
          {button}
        </>
      ) : (
        <>
          <p className="fleet-line">{view.line}</p>
          {button}
          <div className="ai-list-wrap"><Table caption="AI fleets" columns={COLUMNS} rows={view.fleets.map(rowOf)} /></div>
        </>
      )}
      <p className="fleet-line ask-muted">{LIST_WORDS.players}<a href={PLAYERS_FLEET_PATH}>{LIST_WORDS.playersLink}</a></p>
    </div>
  );
}
