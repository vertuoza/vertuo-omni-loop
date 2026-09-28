import type { HighScores as Counts } from '../scores';
import './HighScores.css';

// High scores (PRD 261, reframed by PRD 285): the loop's own shipped work, counted each time the page
// is built (scores.ts). Only the first label changed: a shipped PRD reads as a feature shipped.

/** The three counters, in order: each label and the count it shows. */
export const scoreRows = (scores: Counts) => [
  ['FEATURES SHIPPED', scores.prdsShipped],
  ['SLICES MERGED', scores.slicesMerged],
  ['DECISIONS ADOPTED', scores.decisionsAdopted],
] as const;

export function HighScores({ scores }: { scores: Counts }) {
  return (
    <section className="home-spread" aria-labelledby="home-scores">
      <h2 id="home-scores" className="home-spread-head">High scores: <em>the loop built this</em></h2>
      <p className="home-lead">Omni Loop is built with Omni Loop.</p>
      <div className="home-scores">
        {scoreRows(scores).map(([label, value]) => (
          <div key={label} className="home-score"><span>{label}</span> <b>{value}</b></div>
        ))}
      </div>
      <p className="home-note">Counted from the loop&apos;s own shipped work, each time this page is built.</p>
    </section>
  );
}
