import type { ReactNode } from 'react';
import { CouldNotLoad, LinkGithub } from '../Notes';
import { UNREADABLE, type PartProps } from '../part';
import type { RankingsValue } from './load';
import { GAP, type FleetRank, type IndividualRow } from './rank';

// The rankings' view (PRD 328): two tables, this season, drawn on the server. Fleets lists every
// fleet with its rank, its label and its points; Individuals the top 3, then you with your
// neighbours, `⋯` standing for the ranks skipped. Yours are marked with ◀, which a screen reader
// hears as words instead (aria-current, and a visually hidden "your fleet" or "you"). With no points
// this season, or no GitHub login to find you by, the individuals' table says which below the top 3;
// when the galaxy cannot be read, both tables say they could not load. A season with no fleet to rank
// (a workspace with no fleets, PRD 400) has no Fleets table, and no heading for one.

const COUNT = new Intl.NumberFormat('en-US');

const NO_POINTS = 'No points yet this season';

/** The mark on your row: an arrow for the eye, words for a screen reader. */
function Mark({ words }: { words: string }) {
  return <td className="dash-rank-mark"><span aria-hidden="true">◀</span><span className="ask-sr">{words}</span></td>;
}

/** A table of ranks, named by its heading: rank, name, points, and the mark. */
function Table({ labelledBy, name, children }: { labelledBy: string; name: string; children: ReactNode }) {
  return (
    <table className="dash-rank-table" aria-labelledby={labelledBy}>
      <thead>
        <tr>
          <th scope="col"><span className="ask-sr">Rank</span></th>
          <th scope="col"><span className="ask-sr">{name}</span></th>
          <th scope="col"><span className="ask-sr">Points</span></th>
          <td />
        </tr>
      </thead>
      <tbody>{children}</tbody>
    </table>
  );
}

function Row({ rank, name, points, mark }: { rank: number; name: string; points: number; mark: string | null }) {
  return (
    <tr aria-current={mark ? 'true' : undefined}>
      <td className="dash-rank-rank">{rank}</td>
      <td className="dash-rank-name">{name}</td>
      <td className="dash-rank-points">{COUNT.format(points)}</td>
      {mark ? <Mark words={mark} /> : <td className="dash-rank-mark" />}
    </tr>
  );
}

function Fleets({ fleets }: { fleets: FleetRank[] }) {
  return (
    <Table labelledBy="dash-rank-fleets" name="Fleet">
      {fleets.map((f) => <Row key={f.name} rank={f.rank} name={f.label} points={f.points} mark={f.yours ? 'your fleet' : null} />)}
    </Table>
  );
}

function Individuals({ rows, you }: { rows: (IndividualRow | typeof GAP)[]; you: RankingsValue['you'] }) {
  return (
    <>
      {rows.length > 0 && (
        <Table labelledBy="dash-rank-heroes" name="Name">
          {rows.map((r, i) => (r === GAP
            ? (
              <tr key={`gap-${i}`} className="dash-rank-gap">
                <td colSpan={4}><span aria-hidden="true">⋯</span><span className="ask-sr">ranks skipped</span></td>
              </tr>
            )
            : <Row key={r.rank} rank={r.rank} name={r.name} points={r.points} mark={r.you ? 'you' : null} />))}
        </Table>
      )}
      {you === 'no-points' && <p className="dash-note">{NO_POINTS}</p>}
      {you === 'no-github' && <LinkGithub />}
    </>
  );
}

export function Rankings({ part, season }: PartProps<RankingsValue>) {
  return (
    <section className="dash-rankings" aria-label="The rankings">
      {(part === UNREADABLE || part.fleets.length > 0) && (
        <div className="dash-rank">
          <h2 id="dash-rank-fleets">{`Fleets · ${season.name}`}</h2>
          {part === UNREADABLE ? <CouldNotLoad /> : <Fleets fleets={part.fleets} />}
        </div>
      )}
      <div className="dash-rank">
        <h2 id="dash-rank-heroes">{`Individuals · ${season.name}`}</h2>
        {part === UNREADABLE ? <CouldNotLoad /> : <Individuals rows={part.individuals} you={part.you} />}
      </div>
    </section>
  );
}
