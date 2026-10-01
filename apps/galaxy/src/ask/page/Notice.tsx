import type { ReactNode } from 'react';

// One card in the ask column: not found, not available here, the database out of reach. The
// session's own states (working, moved, closed) are drawn by AskSession.

export function Notice({ title, children, tone = 'plain' }: { title: string; children?: ReactNode; tone?: 'plain' | 'error' }) {
  return (
    <div className="ask-col">
      <section className="ask-card" role={tone === 'error' ? 'alert' : undefined}>
        <h1 className={tone === 'error' ? 'ask-error' : undefined}>{title}</h1>
        {children}
      </section>
    </div>
  );
}

/** The ask database did not answer: the pages that read it per request say so the same way. */
export function AskUnreachable() {
  return (
    <Notice title="The ask database could not answer" tone="error">
      <p className="ask-muted">Reload the page in a moment.</p>
    </Notice>
  );
}

/** A deployment with no database: ask mode has nothing to show here. */
export function AskNotOpen() {
  return (
    <Notice title="Ask mode is not open here">
      <p className="ask-muted">This deployment has no database, so it cannot show Claude&apos;s questions.</p>
    </Notice>
  );
}
