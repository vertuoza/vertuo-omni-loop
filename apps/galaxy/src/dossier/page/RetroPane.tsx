import { renderMarkdown } from '../markdown';
import type { RetroView } from './view';

// The Retro tab of /prd/<id> (PRD 426, part 4): how the delivery went, read from GitHub. On top, Open
// the retro PR; then retro.md, rendered with the dossier's markdown renderer (raw HTML off, the front
// matter as a line above), as the Spec and Plan tabs render theirs. Read-only. Empty, it says why;
// GitHub unreadable, it says so.

export function RetroPane({ retro }: { retro: RetroView }) {
  if (retro.state === 'unread') return <p className="ask-problem" role="alert">{retro.words}</p>;
  const open = retro.prUrl && (
    <p className="outbox-answer">
      <a className="ask-button" href={retro.prUrl} target="_blank" rel="noopener noreferrer">Open the retro PR</a>
    </p>
  );
  if (retro.state === 'empty' || retro.text === null) {
    return (
      <>
        {open}
        <p className="dossier-empty">{retro.words}</p>
      </>
    );
  }
  const markdown = renderMarkdown(retro.text);
  return (
    <>
      {open}
      {markdown.front && <p className="dossier-front">{markdown.front}</p>}
      <article className="dossier-md" dangerouslySetInnerHTML={{ __html: markdown.html }} />
    </>
  );
}
