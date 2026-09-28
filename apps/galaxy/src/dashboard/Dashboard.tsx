import { SectionCards } from './Cards';
import { Counts } from './counts/Counts';
import type { DashboardData } from './load';
import { Rankings } from './rankings/Rankings';
import { Week } from './week/Week';
import { You } from './You';

// The dashboard (PRD 328), top to bottom in the spec's order: you (the hero block), a week of merges,
// the four counts, the rankings, then the app's sections. Each part draws itself from its own value
// (or 'unreadable') and the season, inside its own folder (part.ts); this file only places them.

export function Dashboard({ dashboard }: { dashboard: DashboardData }) {
  const { season } = dashboard;
  return (
    <div className="dash">
      <You name={dashboard.name} you={dashboard.you} season={season} />
      <Week part={dashboard.week} season={season} />
      <Counts part={dashboard.counts} season={season} />
      <Rankings part={dashboard.rankings} season={season} />
      <SectionCards />
    </div>
  );
}
