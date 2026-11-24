import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { jobOf } from './runners.service';
import { missionJobRole } from './mission-role';
import { jobRow } from './fixtures/store.fake';

const MIGRATION = readFileSync(fileURLToPath(new URL('../../../../supabase/migrations/20270129090000_mission_alone_store.sql', import.meta.url)), 'utf8');

describe('missionJobRole', () => {
  it.each([
    ['mission:m:prd:3:review:1', 'reviewer'],
    ['mission:m:prd:3:review:2', 'reviewer'],
    ['mission:m:prd:3:qa:1', 'qa'],
    ['mission:m:prd:3:qa:2', 'qa'],
    ['mission:m:prd:3:approve:1', 'architect'],
    ['mission:m:pm:4', 'pm'],
    ['mission:m:prd:3:run:2', 'engineer'],
    ['mission:m:prd:3:fix:1', 'engineer'],
    ['mission:m:prd:3:qa-fix:1:5', 'engineer'],
    ['mission:m:prd:3:run:2:resume:10', 'engineer'],
    ['mission:m:prd:3:qa:1:resume:1', 'qa'],
    ['mission:m:stuck:1', 'supervisor'],
    ['mission:m:retro:m1', 'supervisor'],
    ['mission:m:prd:3:qa-fix:1:6', 'supervisor'],
  ])('reads %s as %s', (key, role) => {
    expect(missionJobRole(key)).toBe(role);
  });

  it('AC-7: a job of a mission carries its id and role, a job of none carries neither', () => {
    const mission = jobOf(jobRow({ mission_id: 'm-1', mission_key: 'mission:m-1:prd:3:qa:1' }), new Map());
    expect(mission).toMatchObject({ missionId: 'm-1', role: 'qa' });
    expect(jobOf(jobRow({}), new Map())).toMatchObject({ missionId: null, role: null });
  });

  it('is held equal to the migration: every when-clause of public.mission_job_role', () => {
    const body = MIGRATION.slice(MIGRATION.lastIndexOf('create or replace function public.mission_job_role'));
    const clauses = [...body.slice(0, body.indexOf('$$;')).matchAll(/when s\.key ~ (.+?) then '(\w+)'/g)].map((m) => [m[1], m[2]]);
    expect(clauses).toEqual([
      ["':review:[12]$'", 'reviewer'],
      ["':qa:[12]$'", 'qa'],
      ["':approve:[0-9]+$'", 'architect'],
      ["':pm:[0-9]+$'", 'pm'],
      ["':run:[0-9]+$' or s.key ~ ':fix:1$' or s.key ~ ':qa-fix:1:[1-5]$'", 'engineer'],
    ]);
    expect(body).toContain("else 'supervisor'");
    expect(body).toContain("':resume:([1-9]|10)$'");
  });
});
