import { describe, expect, it, vi } from 'vitest';
import { parsePrd } from 'vertuo-omni-plan/kit/lib/ids.ts';
import { attestationScreenOf, type AttestationDeps } from './attestation.controller';
import type { AttestationPorts } from './attestation.service';

vi.mock('server-only', () => ({}));

// The Attestation page's controller (PRD 1612 s4): who reads it decides what it draws, checked first.

const ID = '11111111-1111-4111-8111-111111111111';
const HEAD = '7d3e9a1c2b4f5e6d7c8b9a0f1e2d3c4b5a697887';
const env = { url: 'https://db.example', key: 'anon' };

function deps(over: Partial<AttestationDeps> = {}, facts: AttestationPorts['facts'] = () => Promise.resolve('not-found')) {
  const ports = vi.fn(() => ({ facts, github: null }));
  const all: AttestationDeps = {
    mode: () => 'supabase',
    session: () => Promise.resolve({ env, db: {} as never, user: { id: 'me' } as never }),
    ports,
    ...over,
  };
  return { all, ports };
}

describe('the attestation page, by who reads it', () => {
  it('plays the demo in development, in the state the query names', async () => {
    const { all, ports } = deps({ mode: () => 'demo' });
    const screen = await attestationScreenOf(ID, { state: 'drifted', head: HEAD }, all);
    expect(screen.kind === 'attestation' && [screen.attestation.verdict, screen.attestation.head]).toEqual(['drifted', HEAD]);
    expect(ports).not.toHaveBeenCalled();
  });

  it('is closed without a database, and asks a signed-out visitor to sign in, reading nothing', async () => {
    expect(await attestationScreenOf(ID, {}, deps({ session: () => Promise.resolve(null) }).all)).toEqual({ kind: 'closed' });
    const { all, ports } = deps({ session: () => Promise.resolve({ env, db: {} as never, user: null }) });
    expect(await attestationScreenOf(ID, { signin_error: 'denied' }, all)).toEqual({ kind: 'sign-in', supabase: env, returnPath: `/prd/${ID}/callback`, error: 'denied' });
    expect(ports).not.toHaveBeenCalled();
  });

  it('says not found, and that a PRD approved in its repository has no attestation', async () => {
    expect(await attestationScreenOf(ID, {}, deps().all)).toEqual({ kind: 'not-found' });
    const repoBorn = await attestationScreenOf(ID, {}, deps({}, () => Promise.resolve({ repoBorn: parsePrd(918) })).all);
    expect(repoBorn).toEqual({ kind: 'repo-born', prd: 918, page: `/prd/${ID}` });
  });

  it('says the database could not answer when the record cannot be read', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await attestationScreenOf(ID, { head: HEAD }, deps({}, () => Promise.reject(new Error('down'))).all)).toEqual({ kind: 'database-down' });
    expect(log).toHaveBeenCalledWith(expect.stringContaining('could not be read (down)'));
    log.mockRestore();
  });
});
