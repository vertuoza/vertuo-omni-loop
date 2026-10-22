import { describe, expect, it } from 'vitest';
import { readKnowledgePack, type KnowledgePacksDeps } from './knowledge-packs.controller';
import type { FileRow, KnowledgePacksRepository, PackRow, Stored } from './knowledge-packs.repository';
import { knowledgePacksService } from './knowledge-packs.service';

// GET /api/knowledge-packs (PRD 2011): the sign-in first, then the query, then the pack the caller's
// workspaces hold, through the real service over a repository that keeps packs per workspace as row-level
// security lets a member read them. No test calls Supabase.

const SHA = 'c'.repeat(40);
const OLD = 'a'.repeat(40);
const ADA = 'token-ada';
const EVE = 'token-eve';

type Pack = PackRow & { workspace: string; newest: boolean; files: FileRow[] };

const file = (path: string, content: string, sha256: string): FileRow => ({ path, sha256, content });

/** acme/api's packs: two commits in Ada's workspace, the newest one also in Eve's own. */
const PACKS: Pack[] = [
  { id: 'k-old', workspace: 'w-acme', repository: 'acme/api', sha: OLD, committed_at: '2026-10-15T09:00:00Z', made_at: '2026-10-15T09:01:00Z', newest: false, files: [file('.omni-loop/config.yml', 'kit: 1\n', '1'.repeat(64))] },
  {
    id: 'k-new', workspace: 'w-acme', repository: 'acme/api', sha: SHA, committed_at: '2026-10-16T09:00:00Z', made_at: '2026-10-16T09:01:00Z', newest: true,
    files: [file('.omni-loop/config.yml', 'kit: 1\n', '1'.repeat(64)), file('.omni-loop/knowledge/a.md', '# A\n', '2'.repeat(64))],
  },
];

/** Each token's workspaces. */
const MEMBERS: Record<string, string[]> = { [ADA]: ['w-acme'], [EVE]: ['w-other'] };

/** A repository reading as `token`'s member would: only the packs of their workspaces. */
function repositoryAs(token: string, { failing = false }: { failing?: boolean } = {}): KnowledgePacksRepository & { asked: string[] } {
  const asked: string[] = [];
  const mine = PACKS.filter((pack) => MEMBERS[token]?.includes(pack.workspace));
  const refused = { ok: false, code: 'XX000', message: 'down' } as const;
  return {
    asked,
    pack: (repository, sha) => {
      asked.push(`pack ${repository} ${sha ?? 'newest'}`);
      if (failing) return Promise.resolve(refused);
      const found = mine.filter((pack) => pack.repository === repository && (sha === null ? pack.newest : pack.sha === sha));
      const [row] = found;
      const value: PackRow | null = row ? { id: row.id, repository: row.repository, sha: row.sha, committed_at: row.committed_at, made_at: row.made_at } : null;
      return Promise.resolve<Stored<PackRow | null>>({ ok: true, value });
    },
    files: (packId) => {
      asked.push(`files ${packId}`);
      return Promise.resolve({ ok: true, value: mine.find((pack) => pack.id === packId)?.files ?? [] });
    },
  };
}

/** The deps: a sign-in that knows Ada and Eve, and the service as each. */
function deps({ failing = false, database = true }: { failing?: boolean; database?: boolean } = {}) {
  const lines: string[] = [];
  const asked: string[][] = [];
  const connect = (token: string) => {
    const repository = repositoryAs(token, { failing });
    asked.push(repository.asked);
    return {
      auth: { getUser: (jwt: string) => Promise.resolve(MEMBERS[jwt] ? { data: { user: { id: jwt, email: null } }, error: null } : { data: { user: null }, error: { status: 401 } }) },
      service: knowledgePacksService(repository),
    };
  };
  const given: KnowledgePacksDeps = { connect: database ? connect : null, log: (line) => lines.push(line) };
  return { deps: given, lines, asked: () => asked.flat() };
}

const get = (query: string, token: string | null = ADA) =>
  new Request(`https://omni.example/api/knowledge-packs${query}`, token === null ? {} : { headers: { authorization: `Bearer ${token}` } });

async function answer(response: Response) {
  return { status: response.status, body: (await response.json()) as unknown, cache: response.headers.get('cache-control') };
}

describe('GET /api/knowledge-packs (PRD 2011)', () => {
  it('answers the newest pack of the repository, every file with its sha256 and content, never cached', async () => {
    const { deps: given } = deps();
    expect(await answer(await readKnowledgePack(get('?repo=Acme/API'), given))).toEqual({
      status: 200,
      cache: 'no-store',
      body: {
        repository: 'acme/api',
        sha: SHA,
        committedAt: '2026-10-16T09:00:00Z',
        madeAt: '2026-10-16T09:01:00Z',
        files: [
          { path: '.omni-loop/config.yml', sha256: '1'.repeat(64), content: 'kit: 1\n' },
          { path: '.omni-loop/knowledge/a.md', sha256: '2'.repeat(64), content: '# A\n' },
        ],
      },
    });
  });

  it('answers the pack of a commit when the query names one', async () => {
    const { deps: given } = deps();
    const read = await answer(await readKnowledgePack(get(`?repo=acme/api&sha=${OLD}`), given));
    expect(read).toMatchObject({ status: 200, body: { sha: OLD, files: [{ path: '.omni-loop/config.yml' }] } });
  });

  it('a member of another workspace reads none of this one\'s packs: 404, as if there were none (BR-PRODUCT-63)', async () => {
    const { deps: given } = deps();
    expect(await answer(await readKnowledgePack(get('?repo=acme/api', EVE), given))).toEqual({
      status: 404,
      cache: 'no-store',
      body: { error: 'No knowledge pack of acme/api in your workspaces yet: the App makes one when a merge touches its knowledge folder or flow config.' },
    });
    expect((await answer(await readKnowledgePack(get(`?repo=acme/api&sha=${SHA}`, EVE), given))).body).toEqual({ error: `No knowledge pack of acme/api at ${SHA} in your workspaces.` });
  });

  it('refuses a caller signed out, or with a sign-in no longer valid, before reading anything', async () => {
    const { deps: given, asked } = deps();
    expect((await readKnowledgePack(get('?repo=acme/api', null), given)).status).toBe(401);
    expect((await readKnowledgePack(get('?repo=acme/api', 'token-gone'), given)).status).toBe(401);
    expect(asked()).toEqual([]);
  });

  it('refuses a malformed query, naming its shape, before reading anything', async () => {
    const { deps: given, asked } = deps();
    for (const query of ['', '?repo=acme', '?repo=acme/api&sha=abc', '?repo=acme/api&sha=' + 'C'.repeat(40), '?repo=acme/api&extra=1']) {
      expect(await answer(await readKnowledgePack(get(query), given))).toEqual({
        status: 400,
        cache: 'no-store',
        body: { error: 'Name the repository as `repo=owner/name`, and the commit, when given, as `sha=<the full 40-character commit>`.' },
      });
    }
    expect(asked()).toEqual([]);
  });

  it('answers 503 with no database here', async () => {
    const { deps: given } = deps({ database: false });
    expect(await answer(await readKnowledgePack(get('?repo=acme/api'), given))).toEqual({
      status: 503,
      cache: 'no-store',
      body: { error: 'Knowledge packs are not available here: this deployment has no database.' },
    });
  });

  it('answers 500 in plain words when the database fails, and logs it', async () => {
    const { deps: given, lines } = deps({ failing: true });
    expect(await answer(await readKnowledgePack(get('?repo=acme/api'), given))).toEqual({
      status: 500,
      cache: 'no-store',
      body: { error: 'The knowledge pack could not be read. Try again.' },
    });
    expect(lines).toEqual(['knowledge-packs: acme/api: The knowledge pack could not be read. Try again.']);
  });
});
