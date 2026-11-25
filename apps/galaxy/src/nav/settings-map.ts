// The settings map (omni-loop-27 s1): every page under /app/settings, in the groups a person looks
// for it in. One pure list: the sidebar's Settings entry (SETTINGS.pages, so the trail and the tabs)
// and the settings navigation read it, and a test fails for a settings page that is in no group.
// "Who may change it" is plain text read off each page's current guard; it grants nothing.

/** One settings page: its name, its address, what it holds and who may change it. */
export interface SettingsPage {
  label: string;
  /** The page's address, from the site's root. */
  path: string;
  /** One line of what the page holds. */
  holds: string;
  /** Who may change it, as the page's guard reads today. */
  changedBy: string;
}

export interface SettingsGroup {
  label: string;
  pages: readonly SettingsPage[];
}

export const SETTINGS_MAP: readonly SettingsGroup[] = [
  {
    label: 'Workspace',
    pages: [
      { label: 'Business', path: '/app/settings/business', holds: 'What the workspace sells, to whom, where and against whom.', changedBy: 'Any member' },
      { label: 'Repositories', path: '/app/settings/repositories', holds: 'The repositories the workspace tracks.', changedBy: 'The owner' },
      { label: 'Fleets', path: '/app/settings/fleets', holds: 'The fleets of agents that work for the workspace.', changedBy: 'The owner' },
    ],
  },
  {
    label: 'Access',
    pages: [
      { label: 'API keys', path: '/app/settings/api-keys', holds: 'The keys that let a program read the workspace.', changedBy: 'The owner' },
      { label: 'Jev', path: '/app/settings/jev', holds: 'Whether Jev decides for the workspace, and with which key.', changedBy: 'The owner' },
    ],
  },
  {
    label: 'Knowledge',
    pages: [
      { label: 'Playbook', path: '/app/settings/playbook', holds: 'The settings repository\'s playbook, page by page.', changedBy: 'The owner proposes a change; any member reads it' },
    ],
  },
];

/** Every page of the map, in the order the groups list them. */
export const SETTINGS_MAP_PAGES: readonly SettingsPage[] = SETTINGS_MAP.flatMap((group) => group.pages);
