import type { SettingsStatus } from './settings-home';
import { settingsStatusRepository, type SettingsCounts, type SettingsStatusDb } from './settings-status.repository';

export type { SettingsCounts };

// The settings home's status reads (omni-loop-32 s2; ADR-0095): which page has something to set up, from
// one count each, so the home's chips never cost a table scan. The reads are the repository's; this holds
// the rule: a count of zero is a chip, a count above it none, and a read that fails is no chip at all, so
// the home never errors for a status. Every read starts at once and none waits on another.

const CHECKS: ReadonlyArray<{ path: string; read: keyof SettingsCounts; chip: string }> = [
  { path: '/app/settings/repositories', read: 'repositories', chip: 'No repository tracked' },
  { path: '/app/settings/api-keys', read: 'apiKeys', chip: 'No API key' },
  { path: '/app/settings/jev', read: 'jevOn', chip: 'Jev is off' },
];

/** The chip words by page address, only for the pages whose count is zero. */
export async function settingsStatus(counts: SettingsCounts, workspace: string): Promise<SettingsStatus> {
  const settled = await Promise.all(CHECKS.map(async ({ path, read, chip }) => {
    try {
      return (await counts[read](workspace)) === 0 ? ([path, chip] as const) : null;
    } catch {
      return null;
    }
  }));
  return Object.fromEntries(settled.filter((entry) => entry !== null));
}

/** The home's chips for `workspace`, read as the signed-in person `db` is. */
export const settingsStatusOf = (db: SettingsStatusDb, workspace: string): Promise<SettingsStatus> =>
  settingsStatus(settingsStatusRepository(db), workspace);
