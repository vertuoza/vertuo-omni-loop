import { describe, expect, it } from 'vitest';
import { FleetRowSchema, RepositoryRowSchema, RosterRowSchema, SectorRowSchema } from './fleet.ts';

describe('the org rows', () => {
  it('reads a fleet, a sector, a roster line and a repository, defaults filled in', () => {
    expect(FleetRowSchema.parse({ name: 'beaver', label: 'BEAVER', retired_at: null })).toEqual({ name: 'beaver', home: null, label: 'BEAVER', retired_at: null });
    expect(SectorRowSchema.parse({ name: 'core-belt' })).toEqual({ name: 'core-belt', repos: [] });
    expect(RosterRowSchema.parse({ github_login: 'octo', team: 'beaver' })).toEqual({ github_login: 'octo', team: 'beaver' });
    expect(RepositoryRowSchema.parse({ full_name: 'acme/widgets' })).toEqual({ full_name: 'acme/widgets', tracked: true });
  });

  it('refuses a fleet with no name and a roster line with no team, naming each', () => {
    expect(FleetRowSchema.safeParse({ home: 'core-belt' }).error?.issues[0]?.path).toEqual(['name']);
    expect(RosterRowSchema.safeParse({ github_login: 'octo' }).error?.issues[0]?.path).toEqual(['team']);
    expect(RepositoryRowSchema.safeParse({ full_name: 'ab' }).error?.issues[0]?.path).toEqual(['full_name']);
  });
});
