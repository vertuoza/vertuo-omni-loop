import { PersonChip } from '../../people/PersonChip';
import { QuickAnswer } from './QuickAnswer';
import { questionsCount, type QuestionsView, type RoundEntry, type RoundQuestion } from './view';

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
//
// PRD 498 lightens it: a strip counts the questions answered out of asked, with what is left and a
// meter; the rounds are one outlined list, each round a line (its mark, rule · category, headers, count,
// when asked, outcome). An answered or moved round is a closed <details> with that line as its
// <summary>, so it folds with no script and from the keyboard. An open round is NEVER folded: a plain
// element on --ask-sunk with a yellow edge, every option shown. Unfolded, an answered question reads on
// one line: chip · question → the chosen option(s), in no box.
//
// PRD 652: who asked, who answered and who a quick round waits for each read with their face before
// their name (PersonChip, resolved by account id through the people directory); the words are unchanged.

type Supabase = { url: string; key: string } | null;

function optionsLabel(question: RoundQuestion) {
  return question.multiSelect ? 'Options, any number could be chosen' : 'Options, one could be chosen';
}

/** An answered question, on one line: its chip, the question muted, then → what was chosen, in ink. */
function AnsweredQuestion({ question }: { question: RoundQuestion }) {
  return (
    <div className="dossier-q">
      <p className="dossier-q-text dossier-q-line">
        {question.header && <span className="ask-chip">{question.header}</span>} <span className="dossier-q-asked">{question.question}</span> →{' '}
        {question.options.length > 0 && (
          <span className="dossier-chosen" aria-label={question.options.length > 1 ? 'Chosen options' : 'Chosen option'}>
            {question.options.map((option) => (
              <span key={option.label} className="dossier-choice">
                <span className="dossier-option-label">
                  {option.label}
                  {option.recommended && <span className="ask-rec">Recommended</span>}
                </span>
                {option.description && <span className="dossier-option-desc">{option.description}</span>}
              </span>
            ))}
          </span>
        )}
        {question.written !== null && <span className="dossier-answer">{question.written}</span>}
      </p>
    </div>
  );
}

/** An open question, every option shown as an outlined button; a moved one, its text alone. */
function Question({ question, options = true }: { question: RoundQuestion; options?: boolean }) {
  if (question.shape === 'answered') return <AnsweredQuestion question={question} />;
  return (
    <div className="dossier-q">
      <h3 className="dossier-q-text">
        {question.header && <span className="ask-chip">{question.header}</span>} {question.question}
      </h3>
      {options && question.options.length > 0 && (
        <ul className="dossier-options" aria-label={optionsLabel(question)}>
          {question.options.map((option) => (
            <li key={option.label} className="dossier-option">
              <span className="dossier-option-label">
                {option.label}
                {option.recommended && <span className="ask-rec">Recommended</span>}
              </span>
              {option.description && <span className="dossier-option-desc">{option.description}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const MARK: Record<RoundEntry['state'], { sign: string; label: string }> = {
  answered: { sign: '✓', label: 'answered' },
  open: { sign: '', label: 'waiting for an answer' },
  moved: { sign: '', label: 'moved to the terminal' },
};

/** The outcome, the face of whoever answered before their name (PRD 652). */
function Outcome({ round }: { round: RoundEntry }) {
  const by = round.answeredBy;
  return by ? <>answered by <PersonChip person={by.person} size="inline" />{by.rest}</> : <>{round.outcome}</>;
}

/** A round's line: its mark, rule · category, headers, count, when it was asked, and the outcome. */
function Line({ round }: { round: RoundEntry }) {
  const mark = MARK[round.state];
  return (
    <>
      <span className="dossier-mark" data-state={round.state} role="img" aria-label={mark.label}>{mark.sign}</span>
      <span className="dossier-round-title">
        <span className="dossier-rule">{round.rule}</span>
        <span className="dossier-category" data-category={round.categoryValue ?? 'unsorted'}>{round.category}</span>
        {round.headers && <span className="dossier-round-headers">— {round.headers}</span>}
      </span>
      <span className="dossier-round-count">
        {round.state === 'open' ? <span className="dossier-left">{round.count}</span> : round.count}
      </span>
      <span className="ask-hint dossier-round-when">{round.when}</span>
      {round.state !== 'moved' && <span className="dossier-outcome"><Outcome round={round} /></span>}
    </>
  );
}

function Body({ round, supabase }: { round: RoundEntry; supabase: Supabase }) {
  const { quick } = round;
  const buttons = quick !== null && quick.canAnswer && supabase !== null;
  return (
    <div className="dossier-round-body">
      {round.questions.map((question, i) => <Question key={i} question={question} options={!buttons} />)}
      {buttons && <QuickAnswer supabase={supabase} roundId={round.id} quick={quick} />}
      {quick !== null && !quick.canAnswer && (
        <p className="dossier-quick-note">Waiting for <PersonChip person={{ name: quick.owner, face: quick.ownerFace }} size="inline" /></p>
      )}
      {round.state === 'moved' && <p className="dossier-outcome">{round.outcome}</p>}
      <p className="dossier-round-foot">
        <span className="ask-hint">asked by <PersonChip person={round.askedBy} size="inline" /> · {round.askedAt}</span>
        {round.context.length > 0 && <span className="ask-hint">{round.context.join(' · ')}</span>}
        <a className="dossier-round-link" href={round.href}>Open the question</a>
      </p>
    </div>
  );
}

function Round({ round, supabase }: { round: RoundEntry; supabase: Supabase }) {
  return (
    <li id={round.id} className="dossier-round" data-rule={round.rule} data-state={round.state}>
      {round.state === 'open' ? (
        <>
          <div className="dossier-round-line"><Line round={round} /></div>
          <Body round={round} supabase={supabase} />
        </>
      ) : (
        <details className="dossier-fold">
          <summary className="dossier-round-line"><Line round={round} /></summary>
          <Body round={round} supabase={supabase} />
        </details>
      )}
    </li>
  );
}

/** The strip above the list: the questions answered out of asked, what is left, and a meter. */
function Progress({ questions }: { questions: QuestionsView }) {
  const { alert } = questionsCount(questions);
  const share = questions.asked ? Math.round((questions.answered / questions.asked) * 100) : 0;
  return (
    <div className="dossier-progress">
      <p className="dossier-progress-words">
        {questions.answered} of {questions.asked} answered{alert !== null && <> <span className="dossier-left">{alert}</span></>}
      </p>
      <span
        className="dossier-meter" role="meter" aria-label="Questions answered"
        aria-valuemin={0} aria-valuemax={questions.asked} aria-valuenow={questions.answered}
      >
        <span style={{ width: `${share}%` }} />
      </span>
    </div>
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
    <>
      <Progress questions={questions} />
      <ol className="dossier-rounds" aria-label="Questions, in the order they were asked">
        {questions.rounds.map((round) => <Round key={round.id} round={round} supabase={supabase} />)}
      </ol>
    </>
  );
}
