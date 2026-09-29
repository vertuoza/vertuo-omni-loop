import { periodHref, type Query } from './links';
import { PERIODS, type Period } from './period';

// The 7 days / 30 days / Season switch every board draws on top (the dashboard boards and the
// Engineering board alike). Each link keeps the rest of the page's query.
export function PeriodSwitch({ period, path, query }: { period: Period; path: string; query: Query }) {
  return (
    <nav className="board-period" aria-label="Period">
      <ul>
        {PERIODS.map((p) => (
          <li key={p.id}>
            <a href={periodHref(path, query, p.id)} aria-current={p.id === period ? 'page' : undefined}>{p.label}</a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
