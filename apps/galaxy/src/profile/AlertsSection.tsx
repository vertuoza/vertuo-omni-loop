import { CouldNotLoad } from '../dashboard/Notes';
import { UNREADABLE } from '../dashboard/part';
import { AlertSwitches } from './AlertSwitches';
import { ALERTS_LINE } from './alerts';
import type { ProfileAlerts } from './load';

// **Alerts** on your own profile (PRD 1322 s9), under your header: how you are told a PRD waits for
// your approval, then your two switches (./AlertSwitches.tsx), or "could not load" when they could not
// be read. Never on anyone else's profile: the page's server adds them to yours only (./profile.ts).

export function AlertsSection({ alerts }: { alerts: ProfileAlerts }) {
  return (
    <section className="profile-work" aria-labelledby="profile-alerts">
      <h2 id="profile-alerts">Alerts</h2>
      <p className="profile-line">{ALERTS_LINE.intro}</p>
      {alerts.channels === UNREADABLE
        ? <CouldNotLoad />
        : <AlertSwitches channels={alerts.channels} email={alerts.email} publicKey={alerts.publicKey} />}
    </section>
  );
}
