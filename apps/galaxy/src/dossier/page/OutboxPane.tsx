import type { OutboxEntry, OutboxView } from './view';

// The Outbox tab of /prd/<id> (PRD 426, part 4): the decisions the agents took while the PRD was
// built, read from GitHub. On top, Answer on the PR (the feature PR's outbox comment, else the feature
// PR) while an item is open; then the open items, highest rank first, each with its rank, the question
// in plain words, its options (A, the one built, marked) and the recommendation, or what a person must
// do; then the settled items, in the order settled.md holds them: the title, the verdict and the answer
// as it was given. Read-only: answering stays on GitHub. Every text is escaped by React. Empty, it
// says why; GitHub unreadable, it says so.

function OpenItem({ item }: { item: OutboxEntry }) {
  return (
    <li id={item.id} className="outbox-item" data-state="open">
      <p className="dossier-round-top"><span className="outbox-rank">{item.rank}</span></p>
      <h3 className="dossier-q-text">{item.question}</h3>
      {item.options.length > 0 && (
        <ul className="dossier-options" aria-label="Options">
          {item.options.map((option) => (
            <li key={option.letter} className="dossier-option" data-chosen={option.built ? 'true' : undefined}>
              <span className="dossier-option-label">
                {option.letter}. {option.text}
                {option.built && <span className="ask-rec">Built</span>}
              </span>
            </li>
          ))}
        </ul>
      )}
      {item.personSteps !== null && (
        <p className="dossier-answer"><span className="ask-hint">What a person must do</span> {item.personSteps}</p>
      )}
      {item.recommendation !== null && (
        <p className="dossier-answer"><span className="ask-hint">Recommendation</span> {item.recommendation}</p>
      )}
    </li>
  );
}

export function OutboxPane({ outbox }: { outbox: OutboxView }) {
  if (outbox.state === 'unread') return <p className="ask-problem" role="alert">{outbox.words}</p>;
  if (outbox.state === 'empty') return <p className="dossier-empty">{outbox.words}</p>;
  return (
    <>
      {outbox.open.length > 0 && outbox.answerUrl && (
        <p className="outbox-answer">
          <a className="ask-button" href={outbox.answerUrl} target="_blank" rel="noopener noreferrer">Answer on the PR</a>
        </p>
      )}
      <ol className="outbox-items" aria-label="Decisions, open first">
        {outbox.open.map((item) => <OpenItem key={item.id} item={item} />)}
        {outbox.settled.map((item) => (
          <li key={item.id} id={item.id} className="outbox-item" data-state="settled">
            <p className="dossier-round-top"><span className="outbox-verdict">{item.verdict}</span></p>
            <h3 className="dossier-q-text">{item.title}</h3>
            <p className="dossier-answer"><span className="ask-hint">Answer</span> {item.answer}</p>
          </li>
        ))}
      </ol>
    </>
  );
}
