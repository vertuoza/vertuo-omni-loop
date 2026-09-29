import { CouldNotLoad } from '../Notes';
import { UNREADABLE, type Read } from '../part';
import type { Waiting } from './counts';

// Waiting for you (PRD 328, kept on Home by PRD 572): one tile, drawn on the server, a label and a
// number, linking to where waitingCount sends you. Out of reach, it says so under its label and links
// nowhere. A 0 is shown as 0: the tile is never hidden.

const COUNT = new Intl.NumberFormat('en-US');
const LABEL = 'Waiting for you';

export function WaitingTile({ part }: { part: Read<Waiting> }) {
  return (
    <section className="dash-counts" aria-label={LABEL}>
      <ul className="dash-tiles">
        <li className="dash-tile">
          {part === UNREADABLE ? (
            <div className="dash-tile-body">
              <p className="dash-tile-label">{LABEL}</p>
              <CouldNotLoad />
            </div>
          ) : (
            <a className="dash-tile-body dash-tile-link" href={part.href}>
              <span className="dash-tile-label">{LABEL}</span>
              <span className="dash-tile-figure"><b className="dash-tile-number">{COUNT.format(part.count)}</b> right now</span>
            </a>
          )}
        </li>
      </ul>
    </section>
  );
}
