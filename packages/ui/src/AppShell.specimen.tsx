import { AppShell } from './AppShell.tsx';
import { APP_SHELL_CURRENTS } from './AppShell.meta.ts';
import { one } from './meta.ts';
import type { Specimen } from './meta.ts';

const navigation = [
  { id: 'home', label: 'Home', href: '#home', icon: 'home' },
  { id: 'prds', label: 'PRDs', href: '#prds', icon: 'prds' },
  { id: 'outbox', label: 'Outbox', href: '#outbox', icon: 'outbox' },
] as const;

/** How many specimens were drawn: /design shows one per variant and theme, and each navigation needs its own name. */
let drawn = 0;

/** A shell with the first or the second entry current; contained, so /design keeps its one main landmark. */
export const appShellSpecimen: Specimen = (_prop, value) => {
  drawn += 1;
  return (
    <AppShell navigation={navigation} current={one(APP_SHELL_CURRENTS, value)} navLabel={`Primary ${String(drawn)}`} contained>
      Page content
    </AppShell>
  );
};
