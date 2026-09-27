import type { QuestionsView, RoundEntry, RoundQuestion } from './view';

// The Questions tab of /prd/<id> (PRD 216, step 3): the rounds that shaped the PRD, in the order they
// were asked. Each says whether the brainstorm or the delivery asked it, its category (PRD 144), who
// asked it and when, each question with the options it offered — the chosen ones marked in words, not
// only in colour — and the answer as it was given, then who answered and after how long, where it came
// from, and a link to the question on its own page. Every question and answer is text: React escapes
// it, so markup in a question shows as written. Rendered on the server, with no script.

function Question({ question }: { question: RoundQuestion }) {
  return (
    <div className="dossier-q">
      <h3 className="dossier-q-text">
        {question.header && <span className="ask-chip">{question.header}</span>} {question.question}
      </h3>
      {question.options.length > 0 && (
        <ul className="dossier-options" aria-label={question.multiSelect ? 'Options, any number could be chosen' : 'Options, one could be chosen'}>
          {question.options.map((option) => (
            <li key={option.label} className="dossier-option" data-chosen={option.chosen ? 'true' : undefined}>
              <span className="dossier-option-label">
                {option.label}
                {option.recommended && <span className="ask-rec">Recommended</span>}
                {option.chosen && <span className="dossier-chosen">chosen</span>}
              </span>
              {option.description && <span className="dossier-option-desc">{option.description}</span>}
            </li>
          ))}
        </ul>
      )}
      <p className="dossier-answer">
        {question.answer !== null ? <><span className="ask-hint">Answer</span> <b>{question.answer}</b></> : <span className="ask-hint">No answer</span>}
      </p>
    </div>
  );
}

function Round({ round }: { round: RoundEntry }) {
  return (
    <li className="dossier-round" data-rule={round.rule}>
      <p className="dossier-round-top">
        <span className="dossier-rule">{round.rule}</span>
        <span className="dossier-category" data-category={round.categoryValue ?? 'unsorted'}>{round.category}</span>
        <span className="ask-hint">{round.asked}</span>
      </p>
      {round.questions.map((question, i) => <Question key={i} question={question} />)}
      <p className="dossier-outcome">{round.outcome}</p>
      <p className="dossier-round-foot">
        {round.context.length > 0 && <span className="ask-hint">{round.context.join(' · ')}</span>}
        <a className="dossier-round-link" href={round.href}>Open the question</a>
      </p>
    </li>
  );
}

export function QuestionsPane({ questions }: { questions: QuestionsView }) {
  if (questions.rounds === null) {
    return <p className="ask-problem" role="alert">The questions could not be read. Reload the page in a moment.</p>;
  }
  if (questions.rounds.length === 0) {
    return (
      <p className="dossier-empty">
        No question yet. The questions Claude asks with ask mode on show here: those of the brainstorm that opened this
        dossier, and those asked while the PRD is delivered.
      </p>
    );
  }
  return (
    <ol className="dossier-rounds" aria-label="Questions, in the order they were asked">
      {questions.rounds.map((round) => <Round key={round.id} round={round} />)}
    </ol>
  );
}
