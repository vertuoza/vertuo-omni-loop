import { QuickAnswer } from './QuickAnswer';
import type { QuestionsView, RoundEntry, RoundQuestion } from './view';

// The Questions tab of /prd/<id> (PRD 216, step 3): the rounds that shaped the PRD, in the order they
// were asked. Each says whether the brainstorm or the delivery asked it, its category (PRD 144), who
// asked it and when, and each question as it reads now (PRD 384): answered, with only the options
// chosen, each with its description, and any answer no option names as the text written; open, with
// every option it offers; moved to the terminal, with none. Then who answered and after how long (or
// that it moved), where it came from, and a link to the question on its own page. Every question and
// answer is text: React escapes it, so markup in a question shows as written. Each round's element
// carries the round's id, so `#<round id>` lands on it. Rendered on the server, with no script; a quick
// round (PRD 384, part 4) shows, to a person who may answer it, its options as buttons (QuickAnswer),
// and to anyone else "Waiting for <owner>". The demo has no database, and so no buttons.

type Supabase = { url: string; key: string } | null;

function optionsLabel(question: RoundQuestion) {
  if (question.shape === 'answered') return question.options.length > 1 ? 'Chosen options' : 'Chosen option';
  return question.multiSelect ? 'Options, any number could be chosen' : 'Options, one could be chosen';
}

function Question({ question, options = true }: { question: RoundQuestion; options?: boolean }) {
  return (
    <div className="dossier-q">
      <h3 className="dossier-q-text">
        {question.header && <span className="ask-chip">{question.header}</span>} {question.question}
      </h3>
      {options && question.options.length > 0 && (
        <ul className="dossier-options" aria-label={optionsLabel(question)}>
          {question.options.map((option) => (
            <li key={option.label} className="dossier-option" data-chosen={option.chosen ? 'true' : undefined}>
              <span className="dossier-option-label">
                {option.label}
                {option.recommended && <span className="ask-rec">Recommended</span>}
              </span>
              {option.description && <span className="dossier-option-desc">{option.description}</span>}
            </li>
          ))}
        </ul>
      )}
      {question.written !== null && (
        <p className="dossier-answer"><span className="ask-hint">Answer</span> <b>{question.written}</b></p>
      )}
    </div>
  );
}

function Round({ round, supabase }: { round: RoundEntry; supabase: Supabase }) {
  const { quick } = round;
  const buttons = quick !== null && quick.canAnswer && supabase !== null;
  return (
    <li id={round.id} className="dossier-round" data-rule={round.rule}>
      <p className="dossier-round-top">
        <span className="dossier-rule">{round.rule}</span>
        <span className="dossier-category" data-category={round.categoryValue ?? 'unsorted'}>{round.category}</span>
        <span className="ask-hint">{round.asked}</span>
      </p>
      {round.questions.map((question, i) => <Question key={i} question={question} options={!buttons} />)}
      {buttons && <QuickAnswer supabase={supabase} roundId={round.id} quick={quick} />}
      {quick !== null && !quick.canAnswer && <p className="dossier-quick-note">Waiting for {quick.owner}</p>}
      <p className="dossier-outcome">{round.outcome}</p>
      <p className="dossier-round-foot">
        {round.context.length > 0 && <span className="ask-hint">{round.context.join(' · ')}</span>}
        <a className="dossier-round-link" href={round.href}>Open the question</a>
      </p>
    </li>
  );
}

export function QuestionsPane({ questions, supabase = null }: { questions: QuestionsView; supabase?: Supabase }) {
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
      {questions.rounds.map((round) => <Round key={round.id} round={round} supabase={supabase} />)}
    </ol>
  );
}
