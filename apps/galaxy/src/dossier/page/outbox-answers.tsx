'use client';
import { useEffect, useMemo, useState } from 'react';
import { defined } from 'vertuo-omni-plan/kit/lib/narrow.ts';
import { answered, dropPicks, keepKnown, pickable, picksKey, readPicks, recommend, type Pick, type Picks } from './outbox-picks';
import type { Face } from '../../people/face';
import { LoginChip } from './LoginChip';
import { OutboxSend } from './OutboxSend';
import { NOT_NUMBERED, type Chip, type SettledEntry } from './outbox-view';

// Ported from archive/outbox-answers-v1:apps/galaxy/src/outbox/OutboxAnswers.tsx (PRD 251, s9), on
// PRD 426's reader; Send is wired by s11 (./OutboxSend.tsx).
//
// The questions of the Outbox tab (PRD 251, "The Outbox tab"): the toolbar — Select every
// recommendation and Send n answers — then every open question, highest rank first, then two collapsed
// groups, Adopted unless you object and Settled. A decision card offers its options as a radio group (A
// marked built · recommended) and an optional reason; a human-action card, its steps then Done or Not
// done, which needs a reason; an adopted card, Object, which opens its other options. A card with an
// answer nobody has settled yet says what it said, who, where and when, and can be answered again: the
// latest reply wins. Read-only (shipped, closed, or a viewer who may not answer), nothing is picked.
//
// Item text arrives rendered on the server by PRD 216's markdown renderer, raw HTML off. Picks live in
// this component and in the browser's storage, a convenience only: they survive a reload.

/** A card as the tab shows it: its text rendered on the server. */
export type ShownCard = {
  id: string;
  number: number | null;
  rank: string;
  rankWords: string;
  kind: 'decision' | 'action';
  adopted: boolean;
  intro: string | null;
  punchline: string | null;
  question: string;
  decision: string | null;
  options: { letter: string; html: string; built: boolean }[];
  steps: string | null;
  bearsOn: Chip[];
  details: { label: string; html: string }[];
  pending: { text: string; by: string; where: string; when: string | null; url: string | null; counted: boolean; face: Face | null } | null;
};

type Props = {
  dossierId: string;
  open: ShownCard[];
  adopted: ShownCard[];
  settled: SettledEntry[];
  readOnly: boolean;
  /** Shipped or closed: said above the questions, in place of the toolbar. */
  note: string | null;
  /** Set when the viewer may not answer. */
  signIn: string | null;
  /** Why Send is off, or null when it may send. */
  sendOff: string | null;
  /** The viewer's face, shown on a send's result (PRD 652). */
  sender?: Face | null;
};

function Html({ html, className }: { html: string | null; className: string }) {
  return html ? <div className={className} dangerouslySetInnerHTML={{ __html: html }} /> : null;
}

function Pending({ card }: { card: ShownCard }) {
  const { pending } = card;
  if (!pending) return null;
  return (
    <div className="outbox-pending">
      <p>
        <span className="outbox-pending-label">Answered</span> <q>{pending.text}</q>{' '}
        <span className="ask-hint">
          by <LoginChip login={pending.by} face={pending.face} /> {pending.where}{pending.when ? ` · ${pending.when}` : ''}
          {pending.url && <> · <a href={pending.url} target="_blank" rel="noopener noreferrer">the reply</a></>}
        </span>
      </p>
      {!pending.counted && (
        <p className="ask-hint">
          GitHub does not list @{pending.by} as an owner, member or collaborator of this repository, so /omni:yolo-fix will not read this answer.
        </p>
      )}
    </div>
  );
}

type CardProps = {
  card: ShownCard;
  pick: Pick | undefined;
  readOnly: boolean;
  onPick: (number: number, pick: Pick | null) => void;
};

function Reason({ card, pick, readOnly, onPick, label }: CardProps & { label: string }) {
  if (!pick || card.number === null) return null;
  const number = card.number;
  return (
    <label className="outbox-reason">
      <span className="ask-hint">{label}</span>
      <textarea rows={2} value={pick.reason} disabled={readOnly} maxLength={500} onChange={(e) => { onPick(number, { ...pick, reason: e.target.value }); }} />
    </label>
  );
}

/** A card the outbox comment has not numbered yet shows its choices, and none can be picked. */
const nameOf = (card: ShownCard) => `outbox-${card.number ?? card.id}`;

function Options({ card, pick, readOnly, onPick, letters }: CardProps & { letters: string[] }) {
  const { number } = card;
  return (
    <fieldset className="outbox-options" disabled={readOnly || number === null}>
      <legend className="ask-hint">{number === null ? 'The options' : `Your answer to question ${number}`}</legend>
      {card.options.filter((o) => letters.includes(o.letter)).map((option) => (
        <label key={option.letter} className="outbox-option" data-picked={pick?.pick === option.letter ? 'true' : undefined}>
          <input
            type="radio"
            name={nameOf(card)}
            value={option.letter}
            checked={pick?.pick === option.letter}
            onChange={() => { if (number !== null) onPick(number, { pick: option.letter, reason: pick?.reason ?? '' }); }}
          />
          <span className="outbox-option-letter">{option.letter}</span>
          {option.built && <span className="ask-rec">built · recommended</span>}
          <span className="outbox-option-text" dangerouslySetInnerHTML={{ __html: option.html }} />
        </label>
      ))}
    </fieldset>
  );
}

function Done({ card, pick, readOnly, onPick }: CardProps) {
  const { number } = card;
  const choices = [{ value: 'done', label: 'Done' }, { value: 'not-done', label: 'Not done' }];
  return (
    <fieldset className="outbox-options" disabled={readOnly || number === null}>
      <legend className="ask-hint">Is it done?</legend>
      {choices.map((choice) => (
        <label key={choice.value} className="outbox-option" data-picked={pick?.pick === choice.value ? 'true' : undefined}>
          <input
            type="radio"
            name={nameOf(card)}
            value={choice.value}
            checked={pick?.pick === choice.value}
            onChange={() => { if (number !== null) onPick(number, { pick: choice.value, reason: pick?.reason ?? '' }); }}
          />
          <span className="outbox-option-letter">{choice.label}</span>
        </label>
      ))}
    </fieldset>
  );
}

function Details({ card }: { card: ShownCard }) {
  return (
    <>
      {card.bearsOn.length > 0 && (
        <ul className="outbox-chips" aria-label="Bears on">
          {card.bearsOn.map((chip) => <li key={chip.id}><a className="ask-chip" href={chip.href}>{chip.id}</a></li>)}
        </ul>
      )}
      {card.details.length > 0 && (
        <details className="outbox-details">
          <summary>What I had to decide, what I did meanwhile, what it costs, what I could not know</summary>
          {card.details.map((d) => (
            <section key={d.label}>
              <h4>{d.label}</h4>
              <div className="dossier-md" dangerouslySetInnerHTML={{ __html: d.html }} />
            </section>
          ))}
        </details>
      )}
    </>
  );
}

function Card(props: CardProps) {
  const { card, pick, readOnly, onPick } = props;
  const [objecting, setObjecting] = useState(false);
  const others = card.options.filter((o) => o.letter !== 'A').map((o) => o.letter);
  const numbered = card.number !== null;
  const heading = numbered ? `Question ${card.number}` : card.id;
  return (
    <article
      id={card.id}
      className="outbox-card"
      data-kind={card.kind}
      data-adopted={card.adopted ? 'true' : undefined}
      data-answered={card.pending ? 'true' : undefined}
      aria-labelledby={`outbox-q-${card.id}`}
    >
      <header className="outbox-card-head">
        <h3 id={`outbox-q-${card.id}`} className="outbox-number">{heading}</h3>
        <span className="outbox-rank" data-rank={card.adopted ? 'adopted' : card.rank}>{card.rankWords}</span>
      </header>
      {card.intro && <p className="outbox-fun">{card.intro}</p>}
      <Html html={card.question} className="dossier-md outbox-question" />
      {card.decision && (
        <div className="outbox-decision">
          <span className="ask-hint">{card.adopted ? 'Adopted' : 'Decision taken'}</span>
          <div className="dossier-md" dangerouslySetInnerHTML={{ __html: card.decision }} />
        </div>
      )}
      {card.punchline && <p className="outbox-fun">{card.punchline}</p>}
      <Pending card={card} />
      {card.kind === 'action' && <Html html={card.steps} className="dossier-md outbox-steps" />}
      {!numbered && <p className="ask-hint">{NOT_NUMBERED}</p>}
      {card.kind === 'action' && (
        <>
          <Done {...props} />
          <Reason {...props} label={pick?.pick === 'not-done' ? 'Why not (needed)' : 'A note (optional)'} />
        </>
      )}
      {card.kind === 'decision' && !card.adopted && card.options.length > 0 && (
        <>
          <Options {...props} letters={card.options.map((o) => o.letter)} />
          <Reason {...props} label="Why (optional)" />
        </>
      )}
      {card.adopted && others.length > 0 && numbered && !readOnly && (
        objecting || pick !== undefined ? (
          <>
            <Options {...props} letters={others} />
            <Reason {...props} label="Why you object (optional)" />
            <button type="button" className="ask-button quiet" onClick={() => { setObjecting(false); onPick(defined(card.number, 'the question number'), null); }}>
              Withdraw the objection
            </button>
          </>
        ) : (
          <button type="button" className="ask-button quiet" onClick={() => { setObjecting(true); }}>Object</button>
        )
      )}
      <Details card={card} />
    </article>
  );
}

function Settled({ entry }: { entry: SettledEntry }) {
  return (
    <li id={entry.id} className="outbox-settled">
      <p className="outbox-settled-top">
        <b>{entry.number !== null ? `Question ${entry.number}` : entry.id}</b>{' '}
        <span className="outbox-rank" data-rank="settled">{entry.verdict}</span>{' '}
        <span className="ask-hint">
          {entry.title}
          {entry.by && <> · approved by <LoginChip login={entry.by} face={entry.face} /></>}{entry.when ? ` · ${entry.when}` : ''}
          {entry.url && <> · <a href={entry.url} target="_blank" rel="noopener noreferrer">the reply</a></>}
        </span>
      </p>
      <p className="outbox-settled-answer">{entry.answer}</p>
    </li>
  );
}

export function OutboxAnswers({ dossierId, open, adopted, settled, readOnly, note, signIn, sendOff, sender = null }: Props) {
  const questions = useMemo(() => pickable([...open, ...adopted]), [open, adopted]);
  const [picks, setPicks] = useState<Picks>({});
  const key = picksKey(dossierId);

  // Picks survive a reload: read once the page is in the browser, kept after every change.
  useEffect(() => {
    if (readOnly) return;
    try {
      setPicks(keepKnown(questions, readPicks(window.localStorage.getItem(key))));
    } catch {
      // No storage here (a private window, blocked site data): picks just do not survive a reload.
    }
  }, [key, questions, readOnly]);

  function change(next: Picks) {
    setPicks(next);
    try {
      window.localStorage.setItem(key, JSON.stringify(next));
    } catch {
      // As above.
    }
  }

  // Picks answered by a posted send, or settled meanwhile (PRD 251, s11): read against the latest picks.
  const drop = (numbers: number[]) => {
    setPicks((current) => {
      const next = dropPicks(current, numbers);
      try {
        window.localStorage.setItem(key, JSON.stringify(next));
      } catch {
        // As above.
      }
      return next;
    });
  };

  const onPick = (number: number, pick: Pick | null) => {
    change(pick ? { ...picks, [number]: pick } : dropPicks(picks, [number]));
  };

  const count = answered(questions, picks);
  const openDecisions = questions.some((q) => q.kind === 'decision' && !q.adopted);
  const card = (c: ShownCard) => <Card key={c.id} card={c} pick={c.number === null ? undefined : picks[c.number]} readOnly={readOnly} onPick={onPick} />;

  return (
    <div className="outbox-answers">
      {note && <p className="outbox-note" role="status">{note}</p>}
      {!note && signIn && <p className="outbox-note" role="status">{signIn}</p>}
      {!readOnly && (
        <div className="outbox-toolbar" role="toolbar" aria-label="Answers">
          <button type="button" className="ask-button quiet" onClick={() => { change(recommend(questions, picks)); }} disabled={!openDecisions}>
            Select every recommendation
          </button>
          <OutboxSend dossierId={dossierId} questions={questions} picks={picks} count={count} sendOff={sendOff} onDrop={drop} sender={sender} />
        </div>
      )}
      {open.length === 0 ? (
        <p className="outbox-nothing">Nothing is waiting on you.</p>
      ) : (
        <div className="outbox-cards">{open.map(card)}</div>
      )}
      {adopted.length > 0 && (
        <details className="outbox-group">
          <summary>Adopted unless you object · {adopted.length}</summary>
          <div className="outbox-cards">{adopted.map(card)}</div>
        </details>
      )}
      {settled.length > 0 && (
        <details className="outbox-group">
          <summary>Settled · {settled.length}</summary>
          <ul className="outbox-settled-list">{settled.map((entry) => <Settled key={entry.id} entry={entry} />)}</ul>
        </details>
      )}
    </div>
  );
}
