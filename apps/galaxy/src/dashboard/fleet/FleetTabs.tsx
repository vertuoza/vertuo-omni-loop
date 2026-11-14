import { hrefWith, type Query } from '../board/links';
import { FLEET_TABS, type FleetTab } from './tabs';

// A virtual fleet's tabs (PRD 2842 s6, the `fleet-frame` screen), linked by `?tab=`, each keeping the rest of
// the query, the current one marked.

export function FleetTabs({ current, query, path }: { current: FleetTab; query: Query; path: string }) {
  return (
    <nav className="fleet-tabs" aria-label="Fleet tabs">
      <ul>
        {FLEET_TABS.map((tab) => (
          <li key={tab.id}>
            <a href={hrefWith(path, query, { tab: tab.id })} aria-current={tab.id === current ? 'page' : undefined}>{tab.label}</a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
