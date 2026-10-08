import type { Idea, LaneView } from './model';
import type { IdeasView } from './source';
import { IDEAS, prdIssueUrl } from './words';
import { SignInProblem, VoteButton } from './vote/VoteButton';
import { AddIdea, BrainstormLine, IdeaControls } from './members/MemberControls';

// /ideas/<owner>/<repo> (PRD 1246, s1): a repository's ideas board, for anyone. Its heading and line,
// then three lanes, Now, Next and Later, side by side on a wide screen and stacked on a phone, Now
// first. A card holds its idea's title, its pitch, its count beside a ▲, and, once a PRD builds it, an
// "In PRD #n" badge linking to that PRD's issue. One HTML page with no script of its own: everything a
// reader and a search engine read is in the markup. A private board and a missing one are the same
// "no public board here" page. The ▲ is a button anyone presses to vote, pressed while the reader's
// own vote is in its count; signed out, it starts a GitHub sign-in that comes back here (s3,
// ./vote/). Its count is in the markup, so the page reads the same with no script. Every card shows
// its "Brainstorm this" line to copy, and a member of the board's workspace also reads Add an idea
// above the lanes and each card's Edit and Archive (s4, ./members/); anyone else sees none of them.

function Card({ idea, repo, member }: { idea: Idea; repo: string; member: boolean }) {
  return (
    <article className="idea-card">
      <h3 className="idea-title">{idea.title}</h3>
      <p className="idea-pitch">{idea.pitch}</p>
      <footer className="idea-foot">
        <VoteButton board={repo} ideaId={idea.id} title={idea.title} votes={idea.votes} voted={idea.voted} />
        {idea.prd ? <a className="idea-prd" href={prdIssueUrl(repo, idea.prd)}>{IDEAS.prd(idea.prd)}</a> : null}
      </footer>
      <BrainstormLine idea={idea} />
      {member ? <IdeaControls repo={repo} idea={idea} /> : null}
    </article>
  );
}

function Lane({ lane, repo, member }: { lane: LaneView; repo: string; member: boolean }) {
  const id = `lane-${lane.lane}`;
  return (
    <section className="idea-lane" aria-labelledby={id}>
      <h2 className="idea-lane-head" id={id}>
        <span>{IDEAS.lanes[lane.lane]}</span>{' '}<span className="idea-lane-count">{lane.ideas.length}</span>
      </h2>
      {lane.ideas.length
        ? lane.ideas.map((idea) => <Card key={idea.id} idea={idea} repo={repo} member={member} />)
        : <p className="idea-empty">{IDEAS.emptyLane}</p>}
    </section>
  );
}

export function BoardPage({ view }: { view: IdeasView }) {
  if (view.kind === 'unavailable') {
    return (
      <div className="ask-col idea-page">
        <p className="idea-notice" role="status">{IDEAS.unavailable}</p>
      </div>
    );
  }
  if (view.kind === 'none') {
    return (
      <div className="ask-col idea-page">
        <div className="idea-intro">
          <h1 className="idea-heading">{IDEAS.none.heading}</h1>
          <p className="idea-lede">{IDEAS.none.line}</p>
        </div>
      </div>
    );
  }
  const { board, lanes } = view;
  return (
    <div className="ask-col idea-page">
      <div className="idea-intro">
        <h1 className="idea-heading">{IDEAS.heading(board.repo)}</h1>
        <p className="idea-lede">{IDEAS.line}</p>
        {board.public ? null : <p className="idea-notice">{IDEAS.private}</p>}
        <SignInProblem />
        {board.member ? <AddIdea repo={board.repo} /> : null}
      </div>
      <div className="idea-lanes">
        {lanes.map((lane) => <Lane key={lane.lane} lane={lane} repo={board.repo} member={board.member} />)}
      </div>
    </div>
  );
}
