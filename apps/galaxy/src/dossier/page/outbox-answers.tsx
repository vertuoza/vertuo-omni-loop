'use client';
import { Badge, Button, Card, EmptyState, Field, Inline, Notice, Radio, Textarea } from '@omni/ui';
import { useEffect, useMemo, useState } from 'react';
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
  /** The outbox comment on the pull request, to answer there instead; null when it has none. */
  answerUrl?: string | null;
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

/** A reason is at most this long: what the textarea's maxLength held before it moved onto @omni/ui. */
const REASON_MAX = 500;

function Reason({ card, pick, readOnly, onPick, label }: CardProps & { label: string }) {
  if (!pick || card.number === null) return null;
  const number = card.number;
  return (
    <Field label={label}>
      <Textarea rows={2} value={pick.reason} disabled={readOnly} onChange={(e) => { onPick(number, { ...pick, reason: e.target.value.slice(0, REASON_MAX) }); }} />
    </Field>
  );
}

/** A card the outbox comment has not numbered yet shows its choices, and none can be picked. */
const nameOf = (card: ShownCard) => `outbox-${card.number ?? card.id}`;

function Options({ card, pick, readOnly, onPick, letters }: CardProps & { letters: string[] }) {
  const { number } = card;
  // A click on an option's words picks it as its radio does, unless nothing can be picked.
  const choose = (letter: string) => {
    if (number !== null && !readOnly) onPick(number, { pick: letter, reason: pick?.reason ?? '' });
  };
  return (
    <fieldset className="outbox-options" disabled={readOnly || number === null}>
      <legend className="ask-hint">{number === null ? 'The options' : `Your answer to question ${number}`}</legend>
      {card.options.filter((o) => letters.includes(o.letter)).map((option) => (
        <div key={option.letter} className="outbox-option" data-picked={pick?.pick === option.letter ? 'true' : undefined}>
          <Radio
            label={`Option ${option.letter}`}
            name={nameOf(card)}
            options={[{ value: option.letter, label: option.letter }]}
            value={pick?.pick ?? ''}
            onChange={() => { choose(option.letter); }}
          />
          {option.built && <span className="ask-rec">built · recommended</span>}
          <span className="outbox-option-text" onClick={() => { choose(option.letter); }} dangerouslySetInnerHTML={{ __html: option.html }} />
        </div>
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
      <Radio
        label="Is it done?"
        name={nameOf(card)}
        options={choices}
        value={pick?.pick ?? ''}
        orientation="horizontal"
        onChange={(e) => { if (number !== null) onPick(number, { pick: e.target.value, reason: pick?.reason ?? '' }); }}
      />
    </fieldset>
  );
}

function Details({ card }: { card: ShownCard }) {
  return (
    <>
      {card.bearsOn.length > 0 && (
        <Inline gap="1">
          {card.bearsOn.map((chip) => <a key={chip.id} className="ask-chip" href={chip.href}>{chip.id}</a>)}
        </Inline>
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

/** How a rank is drawn: a person's own step shouts, the rest stay quiet (a Badge has no signal tone). */
const RANK_TONE: Record<string, 'danger' | 'warning' | 'neutral'> = { 'human-action': 'danger', high: 'warning' };

/** An adopted card: Object, which opens its other options and a way to withdraw. */
function Objection(props: CardProps) {
  const { card, pick, readOnly, onPick } = props;
  const [objecting, setObjecting] = useState(false);
  const others = card.options.filter((o) => o.letter !== 'A').map((o) => o.letter);
  const number = card.number;
  if (others.length === 0 || number === null || readOnly) return null;
  if (!objecting && pick === undefined) return <Button variant="quiet" size="sm" onClick={() => { setObjecting(true); }}>Object</Button>;
  return (
    <>
      <Options {...props} letters={others} />
      <Reason {...props} label="Why you object (optional)" />
      <Button variant="quiet" size="sm" onClick={() => { setObjecting(false); onPick(number, null); }}>Withdraw the objection</Button>
    </>
  );
}

/** What a person answers with on a card: Done or Not done, the options, or Object on an adopted one. */
function Answering(props: CardProps) {
  const { card, pick } = props;
  if (card.kind === 'action') {
    return (
      <>
        <Done {...props} />
        <Reason {...props} label={pick?.pick === 'not-done' ? 'Why not (needed)' : 'A note (optional)'} />
      </>
    );
  }
  if (card.adopted) return <Objection {...props} />;
  if (card.options.length === 0) return null;
  return (
    <>
      <Options {...props} letters={card.options.map((o) => o.letter)} />
      <Reason {...props} label="Why (optional)" />
    </>
  );
}

/** What was asked and decided on a card: its intro, question, decision and punchline. */
function Said({ card }: { card: ShownCard }) {
  return (
    <>
      {card.intro && <p className="outbox-fun">{card.intro}</p>}
      <Html html={card.question} className="dossier-md outbox-question" />
      {card.decision && (
        <div className="outbox-decision">
          <span className="ask-hint">{card.adopted ? 'Adopted' : 'Decision taken'}</span>
          <div className="dossier-md" dangerouslySetInnerHTML={{ __html: card.decision }} />
        </div>
      )}
      {card.punchline && <p className="outbox-fun">{card.punchline}</p>}
    </>
  );
}

function QuestionCard(props: CardProps) {
  const { card } = props;
  return (
    <article
      id={card.id}
      className="outbox-entry"
      data-kind={card.kind}
      data-adopted={card.adopted ? 'true' : undefined}
      data-answered={card.pending ? 'true' : undefined}
      aria-labelledby={`outbox-q-${card.id}`}
    >
      <Card>
        <div className="outbox-entry-body">
          <header className="outbox-entry-head">
            <h3 id={`outbox-q-${card.id}`} className="outbox-number">{card.number === null ? card.id : `Question ${card.number}`}</h3>
            <span className="outbox-rank" data-rank={card.adopted ? 'adopted' : card.rank}>
              <Badge tone={card.adopted ? 'neutral' : RANK_TONE[card.rank] ?? 'neutral'}>{card.rankWords}</Badge>
            </span>
          </header>
          <Said card={card} />
          <Pending card={card} />
          {card.kind === 'action' && <Html html={card.steps} className="dossier-md outbox-steps" />}
          {card.number === null && <p className="ask-hint">{NOT_NUMBERED}</p>}
          <Answering {...props} />
          <Details card={card} />
        </div>
      </Card>
    </article>
  );
}

/** Or answer where the outbox comment is: the latest answer wins. */
function PullRequestLine({ url }: { url: string }) {
  return (
    <p className="ask-hint outbox-pr">
      Or answer <a href={url} target="_blank" rel="noopener noreferrer">on the pull request</a>: the latest answer wins.
    </p>
  );
}

function Settled({ entry }: { entry: SettledEntry }) {
  return (
    <li id={entry.id} className="outbox-settled">
      <p className="outbox-settled-top">
        <b>{entry.number !== null ? `Question ${entry.number}` : entry.id}</b>{' '}
        <span className="outbox-rank" data-rank="settled"><Badge tone="success">{entry.verdict}</Badge></span>{' '}
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

export function OutboxAnswers({ dossierId, open, adopted, settled, readOnly, answerUrl = null, note, signIn, sendOff, sender = null }: Props) {
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
  const card = (c: ShownCard) => <QuestionCard key={c.id} card={c} pick={c.number === null ? undefined : picks[c.number]} readOnly={readOnly} onPick={onPick} />;

  return (
    <div className="outbox-answers">
      {note && <Notice tone="info">{note}</Notice>}
      {!note && signIn && <Notice tone="info">{signIn}</Notice>}
      {!readOnly && (
        <div className="outbox-toolbar" role="toolbar" aria-label="Answers">
          <Button variant="quiet" onClick={() => { change(recommend(questions, picks)); }} disabled={!openDecisions}>
            Select every recommendation
          </Button>
          <OutboxSend dossierId={dossierId} questions={questions} picks={picks} count={count} sendOff={sendOff} onDrop={drop} sender={sender} />
          {answerUrl && <PullRequestLine url={answerUrl} />}
        </div>
      )}
      {readOnly && answerUrl && <PullRequestLine url={answerUrl} />}
      {open.length === 0 ? (
        <EmptyState size="inline" title="Nothing is waiting on you." />
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
