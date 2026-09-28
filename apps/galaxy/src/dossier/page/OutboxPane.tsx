import type { ReactNode } from 'react';
import { renderMarkdown, type RenderedMarkdown } from '../markdown';
import { OutboxAnswers, type ShownCard } from './outbox-answers';
import { ContextDisclosure } from './outbox-context';
import type { ContextView, OutboxCard, OutboxView } from './outbox-view';
import { FRAME_SANDBOX } from './sandbox';

// The Outbox tab of /prd/<id> (PRD 426, part 4; PRD 251, s9): the place to answer the decisions the
// agents took while the PRD was built, read from GitHub. Empty, it says why; GitHub unreadable, it says
// so, and the other tabs are unchanged. Otherwise, beside the questions (./outbox-answers.tsx), the
// context rail — the before/after page (the sandboxed frame of PRD 216), the spec (rendered, raw HTML
// off) or the brainstorm's questions with their answers — switched by links, so it works before any
// script runs. Wide, the rail sits on the right and stays where it is while the questions scroll; tall,
// it is a Context disclosure above them. Item text is rendered here, on the server, raw HTML off; the
// page ships the HTML, never the renderer.

type Props = {
  dossierId: string;
  outbox: OutboxView;
  /** The latest spec, rendered, while the rail shows it; null otherwise, or when it could not be read. */
  spec: RenderedMarkdown | null;
};

const html = (text: string | null | undefined) => (text && text.trim() ? renderMarkdown(text).html : null);

/** A card with its text rendered. */
export function shownCard(card: OutboxCard): ShownCard {
  return {
    ...card,
    question: html(card.question) ?? '',
    decision: html(card.decision),
    options: card.options.map((o) => ({ letter: o.letter, html: html(o.text) ?? '', built: o.built })),
    steps: html(card.steps),
    details: card.details.map((d) => ({ label: d.label, html: html(d.text) ?? '' })),
  };
}

function Rail({ context, spec }: { context: ContextView; spec: RenderedMarkdown | null }) {
  const { current } = context;
  let body: ReactNode;
  if (current === 'before-after') {
    body = context.frame ? (
      <figure className="dossier-frame outbox-frame">
        <figcaption className="ask-hint">
          sandboxed · no cookies · no network ·{' '}
          <a href={context.frame} target="_blank" rel="noopener noreferrer">open on its own</a>
        </figcaption>
        <iframe src={context.frame} sandbox={FRAME_SANDBOX} title="Before/after, latest version" />
      </figure>
    ) : <p className="dossier-empty">The before/after page has no version yet.</p>;
  } else if (current === 'spec') {
    if (context.spec === null) body = <p className="dossier-empty">The spec has no version yet.</p>;
    else if (!spec) body = <p className="ask-problem" role="alert">The spec could not be read. Reload the page in a moment.</p>;
    else body = <article className="dossier-md" dangerouslySetInnerHTML={{ __html: spec.html }} />;
  } else if (context.brainstorm === null) {
    body = <p className="ask-problem" role="alert">The brainstorm could not be read. Reload the page in a moment.</p>;
  } else if (context.brainstorm.length === 0) {
    body = <p className="dossier-empty">No brainstorm question was asked with ask mode on.</p>;
  } else {
    body = (
      <ol className="outbox-brainstorm">
        {context.brainstorm.map((q, i) => (
          <li key={i}>
            <p className="dossier-q-text">{q.question}</p>
            <p className="dossier-answer">
              {q.answer !== null ? <><span className="ask-hint">Answer</span> <b>{q.answer}</b></> : <span className="ask-hint">No answer</span>}
            </p>
          </li>
        ))}
      </ol>
    );
  }
  return (
    <ContextDisclosure>
      <nav className="outbox-switch" aria-label="Context">
        {context.links.map((link) => (
          <a key={link.kind} className="outbox-switch-link" href={link.href} aria-current={link.current ? 'page' : undefined}>{link.label}</a>
        ))}
      </nav>
      <div className="outbox-context-body">{body}</div>
    </ContextDisclosure>
  );
}

export function OutboxPane({ dossierId, outbox, spec }: Props) {
  if (outbox.state === 'unread') return <p className="ask-problem" role="alert">{outbox.words}</p>;
  if (outbox.state === 'empty') return <p className="dossier-empty">{outbox.words}</p>;
  return (
    <div className="outbox">
      {outbox.context && <Rail context={outbox.context} spec={spec} />}
      <div className="outbox-main">
        {outbox.answerUrl && (
          <p className="ask-hint outbox-pr">
            Or answer <a href={outbox.answerUrl} target="_blank" rel="noopener noreferrer">on the pull request</a>: the latest answer wins.
          </p>
        )}
        {outbox.repliesUnread && <p className="ask-problem" role="alert">{outbox.repliesUnread}</p>}
        <OutboxAnswers
          dossierId={dossierId}
          open={outbox.open.map(shownCard)}
          adopted={outbox.adopted.map(shownCard)}
          settled={outbox.settled}
          readOnly={outbox.readOnly}
          note={outbox.note}
          signIn={outbox.signIn}
          sendOff={outbox.sendOff}
        />
      </div>
    </div>
  );
}
