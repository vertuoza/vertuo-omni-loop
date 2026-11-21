import { Button, EmptyState, Notice } from '@omni/ui';
import { renderMarkdown } from '../markdown';
import type { RetroView } from './view';

// The Retro tab of /prd/<id> (PRD 426, part 4; drawn in Calm 2 by omni-loop-20 s13): how the delivery went,
// read from GitHub. On top, Open the retro PR; then retro.md, rendered with the dossier's markdown renderer
// (raw HTML off, the front matter as a line above) in a 900 px measure, as the Specifications tab renders
// its own. Read-only. Empty, it says why; GitHub unreadable, it says so.

export function RetroPane({ retro }: { retro: RetroView }) {
  if (retro.state === 'unread') return <Notice tone="danger">{retro.words}</Notice>;
  const open = retro.prUrl && (
    <div className="retro-open">
      <Button href={retro.prUrl} external>Open the retro PR</Button>
    </div>
  );
  if (retro.state === 'empty' || retro.text === null) {
    return (
      <>
        {open}
        <EmptyState size="inline" title={retro.words ?? ''} />
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
