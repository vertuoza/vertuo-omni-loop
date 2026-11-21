'use client';
import { useState } from 'react';
import { Button } from '@omni/ui';
import type { Answered as Sent, CommanderPort } from './commander.client';
import type { Card } from './commander.contract';
import { answerable, answeredBy, answerAs, answersAs, openCount, openPrd, RAIL_WORDS, railHeading, sourceLine } from './rail';

// The Waiting on you rail (PRD 3107 s2, the `fleet-commander` screen's rail of 2.A, 2.C, 2.D and 2.G): one card per
// question of the fleet waiting on a person, built from its record. A card shows where it comes from, its question and
// its choices, and `Answers as <login>`; a click on a choice selects it and asks `Answer as <login>?` with Confirm and
// Cancel (2.G); nothing is sent before Confirm, a secondary button, so the box's Ask stays the view's one primary. An
// answered card reads `Answered by <login> · <time> · <choice>`; a route that refused reads `Not sent: try again.`. An
// approval card links to its PRD's page, where approving stays; a question answered on its own page links there. At
// zero: `Nothing waits on you.` It needs no model. The rules live in ./rail.ts; useRail holds the member's moves and
// makes the call.

/** A card's key in the rail: its source and its id. */
export const cardKey = (card: Pick<Card, 'source' | 'id'>): string => `${card.source}:${card.id}`;

/** The cards once an answer came back: the card as it now stands, when the answer carried it. */
export const cardsAfter = (cards: readonly Card[], key: string, sent: Sent): Card[] =>
  cards.map((c) => (cardKey(c) === key && sent.card !== null ? sent.card : c));

/** The refusals once an answer came back: none on a card answered, by this member or another; the words otherwise. */
export function problemsAfter(problems: ReadonlyMap<string, string>, key: string, sent: Sent): Map<string, string> {
  const next = new Map(problems);
  if (sent.ok || sent.card?.answered) next.delete(key);
  else next.set(key, sent.message);
  return next;
}

/** The rail's state as a member uses it: the card being confirmed, whether its answer is on its way, the refusals. Once
 * an answer comes back, `answered` is told the card's key and what came back. */
export function useRail(calls: Pick<CommanderPort, 'answer'>, answered: (key: string, sent: Sent) => void): Omit<RailProps, 'cards' | 'me'> {
  const [confirming, setConfirming] = useState<{ key: string; card: Card; choice: string } | null>(null);
  const [sending, setSending] = useState(false);
  const [problems, setProblems] = useState<ReadonlyMap<string, string>>(new Map());

  async function confirm() {
    if (confirming === null) return;
    const { key, card, choice } = confirming;
    setSending(true);
    const sent = await calls.answer(card.source, card.id, choice);
    setSending(false);
    setConfirming(null);
    answered(key, sent);
    setProblems((was) => problemsAfter(was, key, sent));
  }

  return {
    confirming: confirming === null ? null : { key: confirming.key, choice: confirming.choice },
    sending,
    problems,
    onPick: (card, choice) => { setConfirming({ key: cardKey(card), card, choice }); },
    onConfirm: () => { void confirm(); },
    onCancel: () => { setConfirming(null); },
  };
}

export interface RailProps {
  cards: readonly Card[];
  me: string | null;
  /** The card being confirmed and the choice picked on it (2.G). */
  confirming: { key: string; choice: string } | null;
  /** Whether a confirmed answer is on its way. */
  sending: boolean;
  /** The words of a refusal, by card key. */
  problems: ReadonlyMap<string, string>;
  onPick: (card: Card, choice: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
}

function Answered({ answered }: { answered: NonNullable<Card['answered']> }) {
  return <p className="commander-by">{answeredBy(answered)}<b>{answered.choice}</b></p>;
}

function Choices({ card, props }: { card: Card; props: RailProps }) {
  const { confirming, sending, me } = props;
  const picked = confirming?.key === cardKey(card) ? confirming.choice : null;
  if (picked !== null) {
    return (
      <>
        <p className="commander-choices"><Button size="sm" variant="secondary" disabled>{picked}</Button></p>
        <p className="commander-confirm">{answerAs(me)}</p>
        <p className="commander-choices">
          <Button size="sm" variant="secondary" onClick={props.onConfirm} disabled={sending}>{RAIL_WORDS.confirm}</Button>
          <Button size="sm" variant="quiet" onClick={props.onCancel} disabled={sending}>{RAIL_WORDS.cancel}</Button>
        </p>
      </>
    );
  }
  return (
    <>
      <p className="commander-choices">
        {card.choices.map((choice) => <Button key={choice} size="sm" variant="secondary" disabled={sending} onClick={() => { props.onPick(card, choice); }}>{choice}</Button>)}
      </p>
      <p className="commander-by">{answersAs(me)}</p>
    </>
  );
}

function RailCard({ card, props }: { card: Card; props: RailProps }) {
  const problem = props.problems.get(cardKey(card));
  const approval = card.source === 'approval';
  return (
    <li className={card.answered === null ? 'commander-card' : 'commander-card commander-card-done'}>
      <p className="commander-src">{sourceLine(card)}</p>
      <p className="commander-q" title={approval ? card.question : undefined}>{approval ? RAIL_WORDS.approve : card.question}</p>
      {card.answered !== null ? <Answered answered={card.answered} />
        : answerable(card) ? <Choices card={card} props={props} />
          : <a href={card.href}>{approval && card.prd !== null ? openPrd(card.prd) : RAIL_WORDS.onItsPage}</a>}
      {problem !== undefined && <p className="commander-failed" role="alert">{problem}</p>}
    </li>
  );
}

export function WaitingRail(props: RailProps) {
  const { cards } = props;
  return (
    <aside className="commander-rail" aria-label={RAIL_WORDS.rail}>
      <p className="commander-rail-h">{railHeading(openCount(cards))}</p>
      {cards.length === 0 ? <p className="commander-nothing">{RAIL_WORDS.nothing}</p> : (
        <ul className="commander-cards">
          {cards.map((card) => <RailCard key={cardKey(card)} card={card} props={props} />)}
        </ul>
      )}
    </aside>
  );
}
