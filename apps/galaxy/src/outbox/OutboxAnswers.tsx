'use client';
import { useEffect, useMemo, useState } from 'react';
import { copyLink } from '../ask/page/share';
import { answered, answers, dropPicks, keepKnown, pickable, picksKey, readPicks, recommend, type Pick, type Picks } from './picks';
import type { SentView } from './sent';
import type { OutboxShown, QuestionCard, SettledView } from './tab';

// The questions of the Outbox tab (PRD 251, "The Outbox tab"): the toolbar — Select every
// recommendation and Send n answers — then every open question worst-first, then two collapsed groups,
// Adopted unless you object and Settled. A decision card offers its options as a radio group (A marked
// built · recommended) and an optional reason; a human-action card, its steps then Done or Not done,
// which needs a reason; an adopted card, Object, which opens its other options. A card with an answer
// nobody has settled yet says what it said, who, where and when, and can be answered again: the latest
// reply wins. Merged or closed, everything is read-only.
//
// Item text arrives rendered on the server by PRD 216's markdown renderer, raw HTML off. Picks live in
// this component and in the browser's storage, a convenience only: they survive a reload.
//
// Send n answers (PRD 251, "Send posts the reply as you") posts the picks to /api/outbox/send, then goes
// to GitHub's authorisation of the omni-loop App, which sends the person back here with the outcome:
// Sent as @login, the reply's link and the next step, or why nothing was posted. A pick whose question
// was settled meanwhile is dropped, and the tab says so before going on to GitHub. Every failure keeps
// the picks; a posted reply clears them, and its answers show as pending until the next outbox.

type Props = {
  dossierId: string;
  view: OutboxShown;
  /** Why Send is off here (the demo, or no send yet), or null when it may send. */
  sendOff: string | null;
  /** What became of the reply this tab just sent, or null. */
  sent?: SentView | null;
};

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

function Html({ html, className }: { html: string | null; className: string }) {
  return html ? <div className={className} dangerouslySetInnerHTML={{ __html: html }} /> : null;
}

function Pending({ card }: { card: QuestionCard }) {
  const { pending } = card;
  if (!pending) return null;
  return (
    <p className="outbox-pending">
      <span className="outbox-pending-label">Answered</span> <q>{pending.text}</q>{' '}
      <span className="ask-hint">
        by @{pending.by} {pending.where}{pending.when ? ` · ${pending.when}` : ''}
        {pending.url && <> · <a href={pending.url} target="_blank" rel="noopener noreferrer">the reply</a></>}
      </span>
    </p>
  );
}

type CardProps = {
  card: QuestionCard;
  pick: Pick | undefined;
  readOnly: boolean;
  onPick: (number: number, pick: Pick | null) => void;
};

function Reason({ card, pick, readOnly, onPick, label }: CardProps & { label: string }) {
  if (!pick) return null;
  return (
    <label className="outbox-reason">
      <span className="ask-hint">{label}</span>
      <textarea
        rows={2}
        value={pick.reason}
        disabled={readOnly}
        maxLength={500}
        onChange={(e) => onPick(card.number, { ...pick, reason: e.target.value })}
      />
    </label>
  );
}

function Options({ card, pick, readOnly, onPick, letters }: CardProps & { letters: string[] }) {
  return (
    <fieldset className="outbox-options" disabled={readOnly}>
      <legend className="ask-hint">Your answer to question {card.number}</legend>
      {card.options.filter((o) => letters.includes(o.letter)).map((option) => (
        <label key={option.letter} className="outbox-option" data-picked={pick?.pick === option.letter ? 'true' : undefined}>
          <input
            type="radio"
            name={`outbox-${card.number}`}
            value={option.letter}
            checked={pick?.pick === option.letter}
            onChange={() => onPick(card.number, { pick: option.letter, reason: pick?.reason ?? '' })}
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
  const choices = [{ value: 'done', label: 'Done' }, { value: 'not-done', label: 'Not done' }];
  return (
    <fieldset className="outbox-options" disabled={readOnly}>
      <legend className="ask-hint">Is it done?</legend>
      {choices.map((choice) => (
        <label key={choice.value} className="outbox-option" data-picked={pick?.pick === choice.value ? 'true' : undefined}>
          <input
            type="radio"
            name={`outbox-${card.number}`}
            value={choice.value}
            checked={pick?.pick === choice.value}
            onChange={() => onPick(card.number, { pick: choice.value, reason: pick?.reason ?? '' })}
          />
          <span className="outbox-option-letter">{choice.label}</span>
        </label>
      ))}
    </fieldset>
  );
}

function Details({ card }: { card: QuestionCard }) {
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
  return (
    <article
      className="outbox-card"
      data-kind={card.kind}
      data-adopted={card.adopted ? 'true' : undefined}
      data-answered={card.pending ? 'true' : undefined}
      aria-labelledby={`outbox-q-${card.number}`}
    >
      <header className="outbox-card-head">
        <h3 id={`outbox-q-${card.number}`} className="outbox-number">Question {card.number}</h3>
        <span className="outbox-rank" data-rank={card.rank}>{card.adopted ? 'adopted' : card.rank}</span>
      </header>
      {card.intro && <p className="outbox-fun">{card.intro}</p>}
      {card.raw !== null ? (
        <Html html={card.raw} className="dossier-md outbox-raw" />
      ) : (
        <>
          <Html html={card.question} className="dossier-md outbox-question" />
          {card.decision && (
            <div className="outbox-decision">
              <span className="ask-hint">{card.adopted ? 'Adopted' : 'Decision taken'}</span>
              <div className="dossier-md" dangerouslySetInnerHTML={{ __html: card.decision }} />
            </div>
          )}
        </>
      )}
      {card.punchline && <p className="outbox-fun">{card.punchline}</p>}
      <Pending card={card} />
      {card.kind === 'action' && <Html html={card.steps} className="dossier-md outbox-steps" />}
      {card.kind === 'action' && card.raw === null && (
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
      {card.adopted && others.length > 0 && !readOnly && (
        objecting || pick !== undefined ? (
          <>
            <Options {...props} letters={others} />
            <Reason {...props} label="Why you object (optional)" />
            <button type="button" className="ask-button quiet" onClick={() => { setObjecting(false); onPick(card.number, null); }}>
              Withdraw the objection
            </button>
          </>
        ) : (
          <button type="button" className="ask-button quiet" onClick={() => setObjecting(true)}>Object</button>
        )
      )}
      <Details card={card} />
    </article>
  );
}

function Settled({ entry }: { entry: SettledView }) {
  return (
    <li className="outbox-settled">
      <p className="outbox-settled-top">
        <b>{entry.number !== null ? `Question ${entry.number}` : entry.id}</b>{' '}
        <span className="outbox-rank" data-rank="settled">{entry.verdict}</span>{' '}
        <span className="ask-hint">
          {entry.by ? `approved by @${entry.by}` : 'approved by nobody'}{entry.at ? ` · ${entry.at}` : ''}
          {entry.url && <> · <a href={entry.url} target="_blank" rel="noopener noreferrer">the reply</a></>}
        </span>
      </p>
      <p className="outbox-settled-answer">{entry.answer}</p>
    </li>
  );
}

function CopyStep({ step }: { step: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <>
      <code>{step}</code>{' '}
      <button type="button" className="ask-button quiet" onClick={async () => setCopied((await copyLink(step, navigator.clipboard, () => {})) === 'copied')}>
        Copy
      </button>
      {copied && <span className="ask-hint" role="status"> Copied.</span>}
    </>
  );
}

const KEPT = 'Your answers are kept: send them again.';

function SentResult({ sent }: { sent: SentView }) {
  if (sent.state === 'failed') return <p className="ask-problem outbox-sent" role="alert">{sent.error} {KEPT}</p>;
  if (sent.state === 'waiting') {
    return <p className="ask-problem outbox-sent" role="alert">GitHub did not send you back with an answer, so nothing was posted. {KEPT}</p>;
  }
  return (
    <div className="outbox-sent" role="status">
      <p>
        <b>Sent as @{sent.login}</b> ·{' '}
        <a href={sent.url} target="_blank" rel="noopener noreferrer">the reply on the pull request</a>
      </p>
      <p>Next, in the terminal: <CopyStep step={sent.next} /></p>
      {!sent.counted && (
        <p className="ask-problem" role="alert">
          GitHub does not list @{sent.login} as an owner, member or collaborator of this repository, so {sent.next.split(' ')[0]} will not read
          the reply. Someone who is should answer.
        </p>
      )}
    </div>
  );
}

type Sending = { state: 'idle' } | { state: 'sending' } | { state: 'refused'; error: string } | { state: 'dropped'; numbers: number[]; authorize: string };

export function OutboxAnswers({ dossierId, view, sendOff, sent = null }: Props) {
  const questions = useMemo(() => pickable([...view.open, ...view.adopted]), [view]);
  const [picks, setPicks] = useState<Picks>({});
  const [sending, setSending] = useState<Sending>({ state: 'idle' });
  const key = picksKey(dossierId);
  const posted = sent?.state === 'posted';

  // Picks survive a reload: read once the page is in the browser, kept after every change. A reply just
  // posted clears them: its answers show as pending instead.
  useEffect(() => {
    if (view.readOnly) return;
    try {
      if (posted) window.localStorage.removeItem(key);
      else setPicks(keepKnown(questions, readPicks(window.localStorage.getItem(key))));
    } catch {
      // No storage here (a private window, blocked site data): picks just do not survive a reload.
    }
  }, [key, questions, view.readOnly, posted]);

  function change(next: Picks) {
    setPicks(next);
    try {
      window.localStorage.setItem(key, JSON.stringify(next));
    } catch {
      // As above.
    }
  }

  const onPick = (number: number, pick: Pick | null) => {
    const next = { ...picks };
    if (pick) next[number] = pick;
    else delete next[number];
    change(next);
  };

  async function send() {
    setSending({ state: 'sending' });
    try {
      const response = await fetch('/api/outbox/send', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ dossier: dossierId, picks: answers(questions, picks) }),
      });
      const body = (await response.json().catch(() => ({}))) as { authorize?: string; dropped?: number[]; error?: string };
      const dropped = body.dropped ?? [];
      if (dropped.length > 0) change(dropPicks(picks, dropped));
      if (!response.ok || !body.authorize) {
        setSending({ state: 'refused', error: body.error ?? `The page could not send (${response.status}). ${KEPT}` });
        return;
      }
      if (dropped.length > 0) setSending({ state: 'dropped', numbers: dropped, authorize: body.authorize });
      else window.location.assign(body.authorize);
    } catch {
      setSending({ state: 'refused', error: `The page could not be reached. ${KEPT}` });
    }
  }

  const count = answered(questions, picks);
  const card = (c: QuestionCard) => <Card key={c.number} card={c} pick={picks[c.number]} readOnly={view.readOnly} onPick={onPick} />;

  return (
    <div className="outbox-answers">
      {view.note ? (
        <p className="outbox-note" role="status">{view.note}</p>
      ) : (
        <div className="outbox-toolbar" role="toolbar" aria-label="Answers">
          <button type="button" className="ask-button quiet" onClick={() => change(recommend(questions, picks))} disabled={view.openCount === 0}>
            Select every recommendation
          </button>
          <button type="button" className="ask-button" disabled={sendOff !== null || count === 0 || sending.state === 'sending'} onClick={send}>
            Send {plural(count, 'answer')}
          </button>
          {sendOff && <span className="ask-hint">{sendOff}</span>}
          {sending.state === 'sending' && <span className="ask-hint" role="status">Sending…</span>}
        </div>
      )}
      {sending.state === 'refused' && <p className="ask-problem outbox-sent" role="alert">{sending.error}</p>}
      {sending.state === 'dropped' && (
        <p className="outbox-sent" role="status">
          {sending.numbers.length === 1 ? `Question ${sending.numbers[0]} was` : `Questions ${sending.numbers.join(', ')} were`} settled
          meanwhile, so {sending.numbers.length === 1 ? 'it is' : 'they are'} left out.{' '}
          <a className="ask-button" href={sending.authorize}>Send the rest through GitHub</a>
        </p>
      )}
      {sending.state === 'idle' && sent && <SentResult sent={sent} />}
      {view.open.length === 0 ? (
        <p className="outbox-nothing">Nothing is waiting on you.</p>
      ) : (
        <div className="outbox-cards">{view.open.map(card)}</div>
      )}
      {view.adopted.length > 0 && (
        <details className="outbox-group">
          <summary>Adopted unless you object · {view.adopted.length}</summary>
          <div className="outbox-cards">{view.adopted.map(card)}</div>
        </details>
      )}
      {view.settled.length > 0 && (
        <details className="outbox-group">
          <summary>Settled · {view.settled.length}</summary>
          <ul className="outbox-settled-list">{view.settled.map((entry) => <Settled key={entry.id} entry={entry} />)}</ul>
        </details>
      )}
    </div>
  );
}
