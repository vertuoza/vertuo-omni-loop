import { describe, expect, it } from 'vitest';
import { SETTINGS_MAP } from '../nav/settings-map';
import { settingsHome } from './settings-home';
import { settingsStatus, settingsStatusOf, type SettingsCounts } from './settings-status.service';

const fake = (counts: Partial<Record<keyof SettingsCounts, number | Error>>): SettingsCounts => {
  const read = (key: keyof SettingsCounts) => () => {
    const value = counts[key] ?? 1;
    return value instanceof Error ? Promise.reject(value) : Promise.resolve(value);
  };
  return { repositories: read('repositories'), apiKeys: read('apiKeys'), jevOn: read('jevOn') };
};

describe('the settings status reads (omni-loop-32 s2)', () => {
  it('AC-2: gives a chip to a page with nothing set up, from its count', async () => {
    const status = await settingsStatus(fake({ repositories: 0, apiKeys: 0, jevOn: 0 }), 'w');
    expect(Object.keys(status).sort()).toEqual(['/app/settings/api-keys', '/app/settings/jev', '/app/settings/repositories']);
    for (const chip of Object.values(status)) expect(chip).toBeTruthy();
  });

  it('resolves a page that is set up to no chip', async () => {
    expect(await settingsStatus(fake({}), 'w')).toEqual({});
  });

  it('chips only the page whose count is zero', async () => {
    expect(Object.keys(await settingsStatus(fake({ apiKeys: 0 }), 'w'))).toEqual(['/app/settings/api-keys']);
  });

  it('a read that fails resolves to no chip, never an error, and blocks no other read', async () => {
    const status = await settingsStatus(fake({ repositories: new Error('down'), apiKeys: 0 }), 'w');
    expect(Object.keys(status)).toEqual(['/app/settings/api-keys']);
  });

  it('starts every read before any settles', async () => {
    const started: string[] = [];
    const never = (name: string) => () => { started.push(name); return new Promise<number>(() => undefined); };
    void settingsStatus({ repositories: never('r'), apiKeys: never('k'), jevOn: never('j') }, 'w');
    await Promise.resolve();
    expect(started).toEqual(['r', 'k', 'j']);
  });

  it('only names pages of the map', async () => {
    const paths = new Set(SETTINGS_MAP.flatMap((g) => g.pages.map((p) => p.path)));
    const status = await settingsStatus(fake({ repositories: 0, apiKeys: 0, jevOn: 0 }), 'w');
    for (const path of Object.keys(status)) expect(paths.has(path)).toBe(true);
    expect(settingsHome(SETTINGS_MAP, status).flatMap((g) => g.pages).filter((p) => p.chip)).toHaveLength(3);
  });

  it('reads head-only counts and the key list through the repository, with no network', async () => {
    const heads: Array<{ table: string; options: unknown }> = [];
    const chain = (table: string, options: unknown, count: number) => {
      heads.push({ table, options });
      const q: Record<string, unknown> = {};
      for (const m of ['eq', 'is', 'neq']) q[m] = () => q;
      q.then = (ok: (v: unknown) => unknown) => Promise.resolve({ count, error: null }).then(ok);
      return q;
    };
    const db = {
      from: (table: string) => ({ select: (_c: string, options: unknown) => chain(table, options, table === 'repositories' ? 2 : 0) }),
      rpc: () => Promise.resolve({ data: [], error: null }),
    };
    expect(await settingsStatusOf(db as never, 'w')).toEqual({ '/app/settings/api-keys': 'No API key', '/app/settings/jev': 'Jev is off' });
    expect(heads.map((h) => h.options)).toEqual([{ count: 'exact', head: true }, { count: 'exact', head: true }]);
  });
});
