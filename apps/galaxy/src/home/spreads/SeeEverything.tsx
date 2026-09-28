import './SeeEverything.css';

// You see everything (PRD 285): what a person can read at every step of the loop. It replaces PLUS
// ALL OF THIS GREAT STUFF! Six bullets, each a name then what it gives you. /releases is the only
// link: it is the one page here that opens without signing in.
const RELEASES = '/releases';

export function SeeEverything() {
  return (
    <section className="home-spread" aria-labelledby="home-see">
      <h2 id="home-see" className="home-spread-head">You see <em>everything</em></h2>
      <p className="home-lead">Every step leaves something a person can read.</p>
      <ul className="home-see">
        <li><b>The outbox</b> lists every decision the agents took without asking; you adopt it or change it.</li>
        <li><b>One page per feature</b> keeps its brief, its plan and its before/after, every version, with the questions that shaped them.</li>
        <li><b>Questions on a web page:</b> the agents ask in your browser, not only in a terminal; a teammate can answer, and every answer is kept.</li>
        <li><b>A knowledge base that grows:</b> settled decisions become rules and decision records the next loop reads, mapped as one graph.</li>
        <li><b>Release notes:</b> every shipped feature, in plain words, on a <a href={RELEASES}>public page</a>.</li>
        <li><b>The galaxy:</b> every feature a planet, every team a fleet, so the whole company sees what moves and what is stuck.</li>
      </ul>
    </section>
  );
}
