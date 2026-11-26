import { SettingsFrame } from '../../../src/settings-frame/SettingsFrame';

// Every page under /app/settings (omni-loop-27 s2): the grouped settings navigation beside it, drawn
// from the settings map, in src/settings-frame. A server component that does not wait: the member
// session and workspace are read once per request through viewer() (omni-loop-29 s1) and the pages share them.

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return <SettingsFrame>{children}</SettingsFrame>;
}
