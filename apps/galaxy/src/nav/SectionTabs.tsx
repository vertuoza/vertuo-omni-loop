import Link from 'next/link';
import { shownCount, spokenTab, type SectionTab } from './section-tabs.ts';
import './section-tabs.css';

// One row of section tabs (PRD 733), at the top of a page a menu entry opens: a link per page, the one
// showing (`current`, its address) carrying aria-current="page", a count only above 0. Drawn in the
// ask pages' tokens (section-tabs.css).

export function SectionTabs({ label, tabs, current }: { label: string; tabs: readonly SectionTab[]; current: string }) {
  return (
    <nav className="section-tabs" aria-label={label}>
      <ul>
        {tabs.map((tab) => {
          const count = shownCount(tab);
          return (
            <li key={tab.href}>
              <Link className="section-tab" href={tab.href} aria-label={spokenTab(tab)} aria-current={tab.href === current ? 'page' : undefined}>
                {tab.label}
                {count !== null && <span className="section-tabs-count">{count}</span>}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
