'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { settingsNav } from './settings-nav';
import './settings-nav.css';

// The grouped navigation beside every settings page (omni-loop-27 s2), drawn from the settings map.
// Both forms are in the server-rendered markup and CSS shows one: the grouped list on a wide window,
// a disclosure (a select's job, with no script) on a narrow one. The page showing carries
// aria-current="page" in both.

export function SettingsNav() {
  const { groups, current } = settingsNav(usePathname());
  return (
    <div className="settings-nav">
      <nav className="settings-nav-list" aria-label="Settings">
        {groups.map((group) => (
          <section key={group.label} className="settings-nav-group">
            <h2 className="settings-nav-heading">{group.label}</h2>
            <ul>
              {group.pages.map((page) => (
                <li key={page.path}>
                  <Link className="settings-nav-link" href={page.path} aria-current={page.current ? 'page' : undefined}>
                    {page.label}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </nav>
      <nav className="settings-nav-select" aria-label="Settings pages">
        <details>
          <summary>{current?.label ?? 'Settings'}</summary>
          {groups.map((group) => (
            <div key={group.label} className="settings-nav-group">
              <p className="settings-nav-heading">{group.label}</p>
              <ul>
                {group.pages.map((page) => (
                  <li key={page.path}>
                    <Link className="settings-nav-link" href={page.path} aria-current={page.current ? 'page' : undefined}>
                      {page.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </details>
      </nav>
    </div>
  );
}
