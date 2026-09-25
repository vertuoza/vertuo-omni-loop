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
