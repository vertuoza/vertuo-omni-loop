import { ANTI_PAGES } from './anti';

// An anti-loop placeholder page (PRD 2490): its title and its two lines, nothing else.

export function AntiPage({ page }: { page: keyof typeof ANTI_PAGES }) {
  const { title, lines } = ANTI_PAGES[page];
  return (
    <section data-screen={`anti-${page}`}>
      <h1 data-primary>{title}</h1>
      {lines.map((line) => <p key={line}>{line}</p>)}
    </section>
  );
}
