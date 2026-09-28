import { CouldNotLoad, LinkGithub } from '../Notes';
import { UNREADABLE, type PartProps } from '../part';
import type { Waiting } from './counts';
import { NO_GITHUB, type CountsValue, type NoGithub } from './load';

// The four counts' view (PRD 328, slice s5): four tiles, drawn on the server, each a label and a
// number, in the spec's order. Waiting for you is a link, to where waitingCount sends you. A tile that
// could not be read says so under its label, and the others still count; one that counts by a GitHub
// login not linked yet says to link it in the arcade. A 0 is shown as 0, and no tile is ever hidden.

const COUNT = new Intl.NumberFormat('en-US');

/** The whole part out of reach: every tile says so, under its label. */
const NONE: CountsValue = { answered: UNREADABLE, settled: UNREADABLE, prds: UNREADABLE, waiting: UNREADABLE };

function Tile({ label, value }: { label: string; value: number | typeof UNREADABLE | NoGithub }) {
  return (
    <li className="dash-tile">
      <div className="dash-tile-body">
        <p className="dash-tile-label">{label}</p>
        {value === UNREADABLE ? <CouldNotLoad />
          : value === NO_GITHUB ? <LinkGithub />
            : <p className="dash-tile-figure"><b className="dash-tile-number">{COUNT.format(value)}</b> this season</p>}
      </div>
    </li>
  );
}

function WaitingTile({ waiting }: { waiting: Waiting | typeof UNREADABLE }) {
  const label = 'Waiting for you';
  if (waiting === UNREADABLE) {
    return (
      <li className="dash-tile">
        <div className="dash-tile-body">
          <p className="dash-tile-label">{label}</p>
          <CouldNotLoad />
        </div>
      </li>
    );
  }
  return (
    <li className="dash-tile">
      <a className="dash-tile-body dash-tile-link" href={waiting.href}>
        <span className="dash-tile-label">{label}</span>
        <span className="dash-tile-figure"><b className="dash-tile-number">{COUNT.format(waiting.count)}</b> right now</span>
      </a>
    </li>
  );
}

export function Counts({ part }: PartProps<CountsValue>) {
  const counts = part === UNREADABLE ? NONE : part;
  return (
    <section className="dash-counts" aria-label="Your counts">
      <ul className="dash-tiles">
        <Tile label="Questions answered" value={counts.answered} />
        <Tile label="Outbox settled" value={counts.settled} />
        <Tile label="PRDs created" value={counts.prds} />
        <WaitingTile waiting={counts.waiting} />
      </ul>
    </section>
  );
}
