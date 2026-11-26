import { SettingsTrail } from '../../../src/settings-home/SettingsTrail';
import { SettingsNav } from '../../../src/nav/SettingsNav';

// Every page under /app/settings (omni-loop-27 s2): the grouped settings navigation beside it, drawn
// from the settings map. A server component: the navigation reads the address itself and both of its
// forms are in the markup.

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="settings-frame">
      <SettingsNav />
      <div className="settings-content">
        <SettingsTrail />
        {children}
      </div>
    </div>
  );
}
