// You see everything (PRD 285): what a person can read at every step of the loop. It replaces PLUS
// ALL OF THIS GREAT STUFF! This slice holds its heading and its line; the six bullets fill it.
export function SeeEverything() {
  return (
    <section className="home-spread" aria-labelledby="home-see">
      <h2 id="home-see" className="home-spread-head">You see <em>everything</em></h2>
      <p className="home-lead">Every step leaves something a person can read.</p>
    </section>
  );
}
