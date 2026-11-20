import { EmptyState, Notice, SegmentedControl } from '@omni/ui';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { renderMarkdown, type RenderedMarkdown } from '../markdown';
import { OutboxAnswers, type ShownCard } from './outbox-answers';
import { ContextDisclosure } from './outbox-context';
import { sendOpen } from '../../outbox/open';
import { OUTBOX_EMPTY, SEND_OFF, type ContextView, type OutboxCard, type OutboxView } from './outbox-view';
import { FRAME_SANDBOX } from './sandbox';

// The Outbox tab of /prd/<id> (PRD 426, part 4; PRD 251, s9): the place to answer the decisions the
// agents took while the PRD was built, read from GitHub. Empty, it says why; GitHub unreadable, it says
// so, and the other tabs are unchanged. Otherwise, beside the questions (./outbox-answers.tsx), the
// context rail — the before/after page (the sandboxed frame of PRD 216), the spec (rendered, raw HTML
// off) or the brainstorm's questions with their answers — switched by a SegmentedControl of links, so it works before any
// script runs. Wide, the rail sits on the right and stays where it is while the questions scroll; tall,
// it is a Context disclosure above them. Item text is rendered here, on the server, raw HTML off; the
// page ships the HTML, never the renderer. Send is open once this deployment knows the omni-loop App's
// client (PRD 251, s11, ./OutboxSend.tsx).

type Props = {
  dossierId: string;
  /** Whether this deployment may send (PRD 251, s11); read from the server's environment when left out. */
  canSend?: boolean;
  outbox: OutboxView;
  /** The latest spec, rendered, while the rail shows it; null otherwise, or when it could not be read. */
  spec: RenderedMarkdown | null;
};

const html = (text: string | null | undefined) => (text && text.trim() ? renderMarkdown(text).html : null);

/** An option's words as plain text, its radio's label: a link keeps its words, emphasis and code marks go. */
export const plainOption = (text: string) => text.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/[*`]/g, '').replace(/\s+/g, ' ').trim();

/** A card with its text rendered. */
export function shownCard(card: OutboxCard): ShownCard {
  return {
    ...card,
    question: html(card.question) ?? '',
    decision: html(card.decision),
    options: card.options.map((o) => ({ letter: o.letter, label: plainOption(o.text), built: o.built })),
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
    ) : <EmptyState size="inline" title="The before/after page has no version yet." />;
  } else if (current === 'spec') {
    if (context.spec === null) body = <EmptyState size="inline" title="The spec has no version yet." />;
    else if (!spec) body = <Notice tone="danger">The spec could not be read. Reload the page in a moment.</Notice>;
    else body = <article className="dossier-md" dangerouslySetInnerHTML={{ __html: spec.html }} />;
  } else if (context.brainstorm === null) {
    body = <Notice tone="danger">The brainstorm could not be read. Reload the page in a moment.</Notice>;
  } else if (context.brainstorm.length === 0) {
    body = <EmptyState size="inline" title="No brainstorm question was asked with ask mode on." />;
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
      <SegmentedControl
        label="Context"
        options={context.links.map((link) => ({ id: link.kind, label: link.label, href: link.href }))}
        value={current}
        size="sm"
        link={Link}
      />
      <div className="outbox-context-body">{body}</div>
    </ContextDisclosure>
  );
}

/** Why Send is off: the view's reason, unless it is only that sending is not wired here and this
 * deployment may send (PRD 251, s11). */
export function sendOffOf(view: OutboxView, canSend: boolean): string | null {
  return view.sendOff === SEND_OFF.notYet && canSend ? null : view.sendOff;
}

export function OutboxPane({ dossierId, outbox, spec, canSend = sendOpen() }: Props) {
  if (outbox.state === 'unread') return <Notice tone="danger">{outbox.words}</Notice>;
  if (outbox.state === 'empty') return <EmptyState size="inline" title={outbox.words ?? OUTBOX_EMPTY} />;
  return (
    <div className="outbox">
      {outbox.context && <Rail context={outbox.context} spec={spec} />}
      <div className="outbox-main">
        {outbox.repliesUnread && <Notice tone="danger">{outbox.repliesUnread}</Notice>}
        <OutboxAnswers
          dossierId={dossierId}
          open={outbox.open.map(shownCard)}
          adopted={outbox.adopted.map(shownCard)}
          settled={outbox.settled}
          readOnly={outbox.readOnly}
          answerUrl={outbox.answerUrl}
          note={outbox.note}
          signIn={outbox.signIn}
          sendOff={sendOffOf(outbox, canSend)}
          sender={outbox.sender}
        />
      </div>
    </div>
  );
}
