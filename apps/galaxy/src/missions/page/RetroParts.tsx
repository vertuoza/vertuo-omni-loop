'use client';
import { Button } from '@omni/ui';
import type { ItemAnswer } from '../missions.contract';
import { RETRO_WORDS, type CiteView, type ItemCard, type RetroCard, type SentenceView, type StuckGoing, type StuckPaused } from './retros';
import { ACTION_WORDS, type MissionView } from './missions-tab';

// What a mission's stuck state, retros and own outbox look like on the Missions tab (PRD 3065 s7, the `mission-start` screen's
// 1.A to 1.E): the stuck line while its repair works, the question a stuck pause asks once, one card per milestone retro and one per
// question with Adopt and Decline. The rules live in ./retros.ts; this file draws them.

/** `Stuck: 5 jobs, nothing moved`, the repair at work, its fix pull request and, once its retro is read, the cause in one sentence. */
export function StuckLine({ stuck }: { stuck: StuckGoing | null }) {
  if (stuck === null) return null;
  return (
    <div className="mission-stuck" role="group" aria-label={stuck.headline}>
      <strong>{stuck.headline}</strong>
      <span className="ask-muted">{stuck.repairing}</span>
      {stuck.fix !== null && <a href={stuck.fix.href}>{stuck.fix.label}</a>}
      {stuck.cause !== null && <small className="ask-muted">{RETRO_WORDS.cause}: {stuck.cause}</small>}
    </div>
  );
}

/** `Paused: stuck`, asked once: the cause, the repairs tried, the proposed fix, what is left, Resume and Stop the mission. */
function StuckPausedBlock({ paused, busy, onResume, onStop }: { paused: StuckPaused; busy: boolean; onResume: () => void; onStop: () => void }) {
  return (
    <div className="mission-stop mission-stuck-paused" role="group" aria-label={paused.headline}>
      <p>{paused.cause}</p>
      {paused.tried.length > 0 && (
        <ol className="mission-stuck-tried" aria-label={RETRO_WORDS.tried}>
          {paused.tried.map((one, n) => <li key={n}>{one.fix === null ? null : <><a href={one.fix.href}>{one.fix.label}</a>{' · '}</>}{one.words}</li>)}
        </ol>
      )}
      {paused.proposedFix !== null && <p><strong>{RETRO_WORDS.proposedFix}:</strong> {paused.proposedFix}</p>}
      <span className="ask-muted">{paused.left}</span>
      <Button variant="primary" disabled={busy} onClick={onResume}>{ACTION_WORDS.resume.idle}</Button>
      <Button variant="quiet" disabled={busy} onClick={onStop}>{RETRO_WORDS.stopMission}</Button>
    </div>
  );
}

function Cite({ cite }: { cite: CiteView }) {
  return cite.href === null ? <>{cite.label}</> : <a href={cite.href}>{cite.label}</a>;
}

/** A sentence of a retro with what it cites, each citation linked when it names a PRD or a pull request. */
function Sentence({ sentence }: { sentence: SentenceView }) {
  return (
    <li>
      {sentence.text}
      {sentence.cites.length > 0 && <small className="ask-muted"> ({sentence.cites.map((cite, n) => <span key={n}>{n > 0 && ', '}<Cite cite={cite} /></span>)})</small>}
    </li>
  );
}

function Side({ title, sentences }: { title: string; sentences: SentenceView[] }) {
  return (
    <>
      <h5>{title}</h5>
      <ul className="mission-retro-side">{sentences.map((sentence, n) => <Sentence key={n} sentence={sentence} />)}</ul>
    </>
  );
}

/** One card per milestone retro: Went well, To change, and the file on the mission branch, or that it is kept on this page only. */
function RetroCards({ cards }: { cards: readonly RetroCard[] }) {
  if (cards.length === 0) return null;
  return (
    <section className="mission-retros" aria-label={RETRO_WORDS.retros}>
      <h4>{RETRO_WORDS.retros}</h4>
      {cards.map((card) => (
        <article key={card.id} className="mission-retro">
          <h5>{card.headline}</h5>
          {card.skipped !== null && <p className="ask-muted">{card.skipped}</p>}
          {card.skipped === null && <Side title={RETRO_WORDS.wentWell} sentences={card.wentWell} />}
          {card.skipped === null && <Side title={RETRO_WORDS.toChange} sentences={card.toChange} />}
          {card.file !== null && <p className="ask-muted"><a href={card.file.href}>{card.file.path}</a> {card.file.words}</p>}
          {card.keptHere !== null && <p className="ask-muted">{card.keptHere}</p>}
        </article>
      ))}
    </section>
  );
}

/** One card per question of the mission's own outbox: Adopt or Decline while it waits; once answered, who answered and the line that applies it. */
function QuestionCards({ cards, busy, onAnswer }: { cards: readonly ItemCard[]; busy: boolean; onAnswer: (item: string, answer: ItemAnswer) => void }) {
  if (cards.length === 0) return null;
  return (
    <section className="mission-questions" aria-label={RETRO_WORDS.questions}>
      <h4>{RETRO_WORDS.questions}</h4>
      {cards.map((card) => (
        <article key={card.id} className="mission-question">
          <h5>{card.title}</h5>
          {card.answered === null ? (
            <>
              <p><strong>{RETRO_WORDS.proposed}:</strong> “{card.wording}”</p>
              <p><strong>{RETRO_WORDS.evidence}:</strong></p>
              <ul>{card.evidence.map((sentence, n) => <li key={n}>{sentence}</li>)}</ul>
              <Button variant="primary" disabled={busy} onClick={() => { onAnswer(card.id, 'adopted'); }}>{RETRO_WORDS.adopt}</Button>
              <Button variant="quiet" disabled={busy} onClick={() => { onAnswer(card.id, 'declined'); }}>{RETRO_WORDS.decline}</Button>
            </>
          ) : (
            <>
              <p>{card.answered.words} by {card.answered.by}: “{card.wording}”</p>
              {card.answered.note !== null && <p className="ask-muted">{card.answered.note}</p>}
              {card.answered.apply !== null && <p className="ask-muted">Not applied yet. To apply: {card.answered.apply}</p>}
            </>
          )}
        </article>
      ))}
    </section>
  );
}

/** What a mission shows under its repairs: the question a stuck pause asks, its Retros and its Questions. */
export function RetroSection({ mission, busy, onResume, onStop, onItem }: { mission: Pick<MissionView, 'stuckPaused' | 'retros' | 'questions'>; busy: boolean; onResume: () => void; onStop: () => void; onItem: (item: string, answer: ItemAnswer) => void }) {
  return (
    <>
      {mission.stuckPaused !== null && <StuckPausedBlock paused={mission.stuckPaused} busy={busy} onResume={onResume} onStop={onStop} />}
      <RetroCards cards={mission.retros} />
      <QuestionCards cards={mission.questions} busy={busy} onAnswer={onItem} />
    </>
  );
}
