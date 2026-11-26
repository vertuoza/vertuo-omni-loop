import Link from 'next/link';
import { SETTINGS_MAP } from '../nav/settings-map';
import { Streamed } from '../skeleton/Streamed';
import { settingsHome, type SettingsHomeGroup, type SettingsStatus } from './settings-home';
import './settings-home.css';

// The settings home (omni-loop-32 s4), at /app/settings: the settings map's groups, each page a card with
// its one-line description and who may change it, and a chip where the page has something to set up.
// The cards are the map's and need no read, so they are in the first paint; the chips arrive after, streamed
// (AC-4), in the cards' own place, so nothing moves when they do.

function SettingsHome({ groups, pending = false }: { groups: readonly SettingsHomeGroup[]; pending?: boolean }) {
  return (
    <div className="settings-home" aria-busy={pending || undefined}>
      <h1 className="settings-home-title">Settings</h1>
      {pending ? <span className="ask-sr">Loading what needs setting up…</span> : null}
      {groups.map((group) => (
        <section key={group.label} className="settings-home-group" aria-labelledby={`settings-home-${group.label}`}>
          <h2 id={`settings-home-${group.label}`} className="settings-home-heading">{group.label}</h2>
          <ul className="settings-home-cards">
            {group.pages.map((page) => (
              <li key={page.path} className="ask-card settings-home-card">
                <div className="settings-home-card-head">
                  <Link href={page.path} className="settings-home-link">{page.label}</Link>
                  {page.chip ? <span className="ask-chip settings-home-chip">{page.chip}</span> : null}
                </div>
                <p className="settings-home-holds">{page.description}</p>
                <p className="ask-muted settings-home-by">Changed by: {page.changedBy}</p>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

/** The home with its chips streamed: the cards at once with no chip, the chips once `status` resolves. A read that fails leaves the cards, no chip. */
export function SettingsHomeStreamed({ status }: { status: Promise<SettingsStatus> }) {
  const cards = (chips: SettingsStatus, pending: boolean) => <SettingsHome groups={settingsHome(SETTINGS_MAP, chips)} pending={pending} />;
  return (
    <Streamed read={status} skeleton={cards({}, true)} failed={cards({}, false)}>
      {(chips) => cards(chips, false)}
    </Streamed>
  );
}
