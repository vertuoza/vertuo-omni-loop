import './InOut.css';

// Easy in, easy out (PRD 285): how a repository adopts the loop, and how it stops. GET IN is the
// four steps adopting takes (no one-command promise, D6); GET OUT is the removal `omni init` itself
// prints, with the fine print about what stays (D7). Both name what `omni init` writes: the folder,
// and the status line in `.claude/settings.json` (PRD 324, D3). The commands, paths and keys sit in
// <code>: they are not prose.
export function InOut() {
  return (
    <section className="home-spread" aria-labelledby="home-in-out">
      <h2 id="home-in-out" className="home-spread-head">Easy in, <em>easy out</em></h2>
      <div className="home-inout">
        <div className="home-inout-col">
          <h3 className="home-inout-head">GET IN</h3>
          <ol className="home-inout-steps">
            <li><code>omni init</code> adds one folder to your repository, <code>.omni-loop/</code>, and a status line to <code>.claude/settings.json</code>.</li>
            <li>Install the omni plugin in Claude Code, and the omni-loop GitHub App.</li>
            <li><code>/omni:invade</code> writes your harness from what your repository already proves. You merge it as one pull request of docs.</li>
            <li><code>/omni:brainstorm</code> your first feature.</li>
          </ol>
        </div>
        <div className="home-inout-col">
          <h3 className="home-inout-head">GET OUT</h3>
          <ul className="home-inout-out">
            <li><b>Delete <code>.omni-loop/</code> and the <code>statusLine</code> in <code>.claude/settings.json</code>, and commit. That&apos;s it.</b></li>
            <li>Everything the agents shipped is ordinary code, ordinary pull requests and git history. Nothing to migrate.</li>
          </ul>
          <p className="home-fine">The GitHub labels and the App installation stay until you remove them.</p>
        </div>
      </div>
    </section>
  );
}
