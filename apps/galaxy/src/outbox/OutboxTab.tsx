import type { RenderedMarkdown } from '../dossier/markdown';
import { FRAME_SANDBOX } from '../dossier/page/sandbox';
import type { ContextView, OutboxPane } from '../dossier/page/view';
import { ContextDisclosure } from './ContextDisclosure';
import { OutboxAnswers } from './OutboxAnswers';
import { outboxView } from './tab';

// The Outbox tab of /prd/<id> (PRD 251, "The Outbox tab"): each state of the spec's table — no outbox
// yet, the read failed, and the outbox itself, open, merged or closed — and, beside the questions, the
// context rail: the before/after page (the sandboxed frame of PRD 216), the spec (rendered, raw HTML
// off) or the brainstorm's questions and their answers, switched by links so it works before any
// script runs. Wide, the rail sits on the right and stays where it is while the questions scroll; tall,
// it is a Context disclosure above them.

/** Send is off: in the demo, and until this page can post a reply as the person. */
export const SEND_OFF = {
  demo: 'A demo outbox: Send is off here.',
  notYet: 'Sending from this page is not open yet: reply on the pull request.',
} as const;

type Props = {
  id: string;
  pane: OutboxPane;
  /** The latest spec, rendered, when Spec is the rail's current switch; null otherwise, or unreadable. */
  spec: RenderedMarkdown | null;
  /** Why Send is off here, or null when it may send. */
  sendOff: string | null;
};

function Rail({ context, spec }: { context: ContextView; spec: RenderedMarkdown | null }) {
  const { current } = context;
  let body: React.ReactNode;
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
    if (!context.specId) body = <p className="dossier-empty">The spec has no version yet.</p>;
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

export function OutboxTab({ id, pane, spec, sendOff }: Props) {
  const { context } = pane;
  const view = outboxView(pane.read);
  if (view.state === 'failed') {
    return <p className="ask-problem" role="alert">The outbox is out of reach. Reload the page in a moment.</p>;
  }
  return (
    <div className="outbox">
      <Rail context={context} spec={spec} />
      <div className="outbox-main">
        {view.state === 'none' ? (
          <p className="dossier-empty">
            No outbox yet. It appears once the feature pull request opens and the omni-loop App has checked it.
          </p>
        ) : (
          <>
            <p className="ask-hint outbox-pr">
              The questions of <a href={view.pr.url} target="_blank" rel="noopener noreferrer">pull request #{view.pr.number}</a>
            </p>
            <OutboxAnswers dossierId={id} view={view} sendOff={sendOff} />
          </>
        )}
      </div>
    </div>
  );
}
