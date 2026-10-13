// The device sign-in's migration (PRD 1660, s1), read as text: the table is closed to every API role,
// only its functions write it, each runs for the service role alone, an approved request is deleted as
// it is handed over, and expired requests go on each issue. The rules over its rows are
// ./device.service.test.ts's to prove, on the fake that keeps these same guards (./device.fake.ts).
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { present } from './test/test-item';

const MIGRATIONS = fileURLToPath(new URL('../../../../supabase/migrations/', import.meta.url));
const read = (file: string) => readFileSync(`${MIGRATIONS}${file}`, 'utf8').replace(/\s+/g, ' ');
const files = () => readdirSync(MIGRATIONS).filter((f) => f.endsWith('.sql')).sort();

const FUNCTIONS = [
  'ask_cli_device_issue(text, text, text, timestamptz, timestamptz, text, integer, text)',
  'ask_cli_device_read(text)',
  'ask_cli_device_polled(text, timestamptz, integer)',
  'ask_cli_device_take(text)',
  'ask_cli_device_find(text)',
  'ask_cli_device_approve(text, text, text, timestamptz, timestamptz)',
  'ask_cli_device_deny(text, timestamptz)',
];

function migration() {
  const file = present(files().find((f) => read(f).includes('create table public.ask_cli_devices')), 'the migration creating ask_cli_devices');
  return { file, sql: read(file) };
}

/** A function's body, between its `$$`. */
function body(sql: string, name: string): string {
  return present(sql.match(new RegExp(`create function public\\.${name}\\(.*?\\$\\$(.*?)\\$\\$`))?.[1], `the body of ${name}`);
}

describe('the device requests\' table', () => {
  it('is dated after the migrations it was written on top of', () => {
    const { file } = migration();
    // Not "the newest of all": every later migration would break this test (PRD 1698, s6).
    expect(files().indexOf(file)).toBeGreaterThan(files().indexOf('20261204100000_outbox_items.sql'));
  });

  it('keeps a device code only as its SHA-256, a user code of the alphabet, and a payload only once approved', () => {
    const { sql } = migration();
    expect(sql).toContain("device_hash text primary key check (device_hash ~ '^[0-9a-f]{64}$')");
    expect(sql).toContain("user_code text not null unique check (user_code ~ '^[BCDFGHJKLMNPQRSTVWXZ2-9]{8}$')");
    expect(sql).toContain("check ((status = 'approved') = (payload is not null))");
    expect(sql).not.toMatch(/device_code\b/);
  });

  it('is closed to anon and authenticated, and the service role reaches it only through its functions', () => {
    const { sql } = migration();
    expect(sql).toContain('alter table public.ask_cli_devices enable row level security;');
    expect(sql).toContain('revoke all on public.ask_cli_devices from anon, authenticated, service_role;');
    expect(sql).not.toMatch(/create policy [^;]* on public\.ask_cli_devices/);
    expect(sql).not.toMatch(/grant [^;]* on public\.ask_cli_devices /);
    for (const fn of FUNCTIONS) {
      expect(sql).toContain(`revoke execute on function public.${fn} from public, anon, authenticated;`);
      expect(sql).toContain(`grant execute on function public.${fn} to service_role;`);
    }
    for (const name of FUNCTIONS.map((fn) => fn.slice(0, fn.indexOf('(')))) {
      expect(sql).toMatch(new RegExp(`create function public\\.${name}\\([^$]*security definer set search_path = ''`));
    }
  });

  it('clears the requests past their time on each issue', () => {
    expect(body(migration().sql, 'ask_cli_device_issue')).toContain('delete from public.ask_cli_devices d where d.expires_at < p_now;');
  });

  it('hands an approved payload over once, deleting its row in the same call', () => {
    const take = body(migration().sql, 'ask_cli_device_take');
    expect(take).toContain("delete from public.ask_cli_devices d where d.device_hash = p_device_hash and d.status = 'approved' returning");
  });

  it('approves and denies only a pending request still in time, approval only of its purpose', () => {
    const { sql } = migration();
    const approve = body(sql, 'ask_cli_device_approve');
    expect(approve).toContain("set status = 'approved'");
    expect(approve).toContain("d.status = 'pending' and d.purpose = p_purpose and d.expires_at > p_now");
    const deny = body(sql, 'ask_cli_device_deny');
    expect(deny).toContain("set status = 'denied'");
    expect(deny).toContain("d.status = 'pending' and d.expires_at > p_now");
    expect(body(sql, 'ask_cli_device_polled')).toContain("d.status = 'pending'");
  });
});
