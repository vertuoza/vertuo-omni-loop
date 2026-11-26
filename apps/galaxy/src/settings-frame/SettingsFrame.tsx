import { viewer } from '../data/viewer';
import { SettingsNav } from '../nav/SettingsNav';
import { warmSettingsReads } from './warm';

// The frame of every page under /app/settings (omni-loop-27 s2, omni-loop-29 s1): the grouped settings
// navigation beside the page. Synchronous on purpose: it starts the shared session and workspace reads
// and returns the frame without waiting for them, so the frame and the navigation are sent before any
// page-specific read finishes.

export function SettingsFrame({ children }: { children: React.ReactNode }) {
  warmSettingsReads(viewer);
  return (
    <div className="settings-frame">
      <SettingsNav />
      <div className="settings-content">{children}</div>
    </div>
  );
}
