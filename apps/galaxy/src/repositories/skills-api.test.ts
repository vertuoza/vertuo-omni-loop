import { describe, expect, it } from 'vitest';
import { SkillsReadSchema } from './model';
import { readRepositorySkills, type SkillsDeps, type SkillsStore } from './skills-api';
import type { SkillsListing } from './skills';

// GET /api/repositories/skills?repo=<owner/name> (PRD 2313 s3), with a stubbed store and a stubbed GitHub
// read: each skill of the default branch allowed or not with who and when, the allowed ones that left it
// `gone`, a failed read's reason with the allowed skills still listed, and each refusal in plain words.

const ADA = '00000000-0000-4000-8000-0000000000a1';
const LISTING: SkillsListing = {
  ok: true,
  branch: 'main',
  skills: [{ name: 'release-notes', description: 'Drafts the release notes.' }, { name: 'validate-prd', description: null }],
};

function world({ member = true, listing = LISTING, signedIn = true, database = true, installation = 7 as number | null, broken = false } = {}) {
  const asked: string[] = [];
  const store: SkillsStore = {
    workspaceOf: (repo) => {
      asked.push(`workspaceOf ${repo}`);
      if (broken) return Promise.reject(new Error('timeout'));
      return Promise.resolve(member ? 'ws-1' : null);
    },
    allowed: () => Promise.resolve([
      { skill: 'validate-prd', allowed_by: ADA, allowed_at: '2026-10-21T09:30:00Z' },
      { skill: 'seed-demo', allowed_by: null, allowed_at: '2026-10-02T08:00:00Z' },
    ]),
    logins: (_workspace, users) => Promise.resolve(new Map(users.filter((u) => u === ADA).map((u) => [u, 'ada']))),
  };
  const deps: SkillsDeps = {
    connect: database ? () => Promise.resolve(signedIn ? store : null) : null,
    installation: () => Promise.resolve(installation),
    read: (id, repo) => { asked.push(`read ${id} ${repo}`); return Promise.resolve(listing); },
  };
  const get = async (query: string) => {
    const response = await readRepositorySkills(new Request(`https://omni.example/api/repositories/skills${query}`), deps);
    return { status: response.status, body: (await response.json()) as unknown, cache: response.headers.get('cache-control') };
  };
  return { asked, get };
}

describe('GET /api/repositories/skills', () => {
  it('answers each skill allowed or not, who allowed it and when, and the allowed one that left as gone', async () => {
    const w = world();
    const answer = await w.get('?repo=Acme/Widgets');
    expect(answer.status).toBe(200);
    expect(answer.cache).toBe('no-store');
    expect(SkillsReadSchema.parse(answer.body)).toEqual({
      skills: [
        { name: 'release-notes', description: 'Drafts the release notes.', allowed: null, gone: false },
        { name: 'validate-prd', description: null, allowed: { by: 'ada', at: '2026-10-21T09:30:00Z' }, gone: false },
        { name: 'seed-demo', description: null, allowed: { by: null, at: '2026-10-02T08:00:00Z' }, gone: true },
      ],
      branch: 'main',
      error: null,
    });
    expect(w.asked).toEqual(['workspaceOf acme/widgets', 'read 7 acme/widgets']);
  });

  it('says why the read failed and still lists the allowed skills, none of them gone', async () => {
    const w = world({ listing: { ok: false, reason: 'GitHub answered 502' } });
    expect((await w.get('?repo=acme/widgets')).body).toEqual({
      skills: [
        { name: 'seed-demo', description: null, allowed: { by: null, at: '2026-10-02T08:00:00Z' }, gone: false },
        { name: 'validate-prd', description: null, allowed: { by: 'ada', at: '2026-10-21T09:30:00Z' }, gone: false },
      ],
      branch: null,
      error: 'GitHub answered 502',
    });
  });

  it('reads a workspace without the Omni App installed as a failed read, calling nothing on GitHub', async () => {
    const w = world({ installation: null });
    expect((await w.get('?repo=acme/widgets')).body).toMatchObject({ error: 'the Omni App is not installed for this workspace' });
    expect(w.asked).toEqual(['workspaceOf acme/widgets']);
  });

  it('refuses a non-member, a stranger to the repository, in plain words', async () => {
    const w = world({ member: false });
    expect(await w.get('?repo=acme/widgets')).toMatchObject({ status: 403, body: { error: 'Not a member of the workspace that lists this repository.' } });
    expect(w.asked).toEqual(['workspaceOf acme/widgets']);
  });

  it('refuses a malformed repository, a signed-out caller, no database and a failed read', async () => {
    expect((await world().get('')).status).toBe(400);
    expect((await world().get('?repo=nonsense')).status).toBe(400);
    expect((await world({ signedIn: false }).get('?repo=acme/widgets')).status).toBe(401);
    expect((await world({ database: false }).get('?repo=acme/widgets')).status).toBe(503);
    expect(await world({ broken: true }).get('?repo=acme/widgets')).toMatchObject({ status: 500, body: { error: 'The runner skills could not be read. Try again.' } });
  });
});
