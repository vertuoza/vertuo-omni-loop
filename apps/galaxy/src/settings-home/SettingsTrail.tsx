'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { SETTINGS_MAP } from '../nav/settings-map';

// The trail in every settings page's header (omni-loop-32 s3): its group and its name, the group
// linking back to the settings home. Read from the settings map, so a page added to it has its trail
// with no further change. Nothing is drawn on the home itself or at an address the map does not hold.

const HOME = '/app/settings';

export function SettingsTrail() {
  const pathname = usePathname();
  for (const group of SETTINGS_MAP) {
    const page = group.pages.find((p) => pathname === p.path || pathname.startsWith(`${p.path}/`));
    if (page) {
      return (
        <nav aria-label="Breadcrumb" className="settings-trail">
          <Link href={HOME}>{group.label}</Link>
          <span aria-hidden="true"> › </span>
          <span aria-current="page">{page.label}</span>
        </nav>
      );
    }
  }
  return null;
}
