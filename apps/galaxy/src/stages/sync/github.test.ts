import { generateKeyPairSync } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { stagesReader } from './github';

// The stages sync's reader, against a stubbed `fetch`: never GitHub itself. A small fake GitHub answers
// by route; each test says what the repository holds.

const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const CREDS = { appId: '123456', privateKey: privateKey.export({ type: 'pkcs1', format: 'pem' }).toString() };
const NOW = Date.parse('2026-09-29T12:00:00Z');
const CONFIG = 'kit: 1\nrepo:\n  slug: acme/widgets\n  defaultBranch: trunk\npaths:\n  delivery: loop/delivery\nlabels:\n  prd: product\n';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const pull = (number: number, head: string, more: Record<string, unknown> = {}) => ({
  number, state: 'open', draft: false, merged_at: null, created_at: '2026-09-20T00:00:00Z', head: { ref: head }, base: { ref: 'trunk' }, ...more,
});

function fakeGithub(repo: { config?: string | null; inbox?: string[]; shipped?: string[]; issues?: unknown[]; pulls?: unknown[]; events?: Record<number, unknown[]>; fail?: RegExp }) {
  const calls: string[] = [];
  const fetchImpl = vi.fn(async (href: string, init: RequestInit) => {
    const url = new URL(href);
    const at = `${url.pathname}${url.search}`;
    calls.push(at);
    if (repo.fail?.test(at)) return json({ message: 'boom' }, 502);
    if (url.pathname === '/app/installations/11/access_tokens' && init.method === 'POST') {
      return json({ token: 'ghs_1', expires_at: new Date(NOW + 3_600_000).toISOString() }, 201);
    }
    if (url.pathname === '/repos/acme/widgets/contents/.omni-loop/config.yml') {
      return repo.config === null ? json({}, 404) : new Response(repo.config ?? CONFIG);
    }
    const dir = /^\/repos\/acme\/widgets\/contents\/loop\/delivery\/(inbox|shipped)$/.exec(url.pathname)?.[1] as 'inbox' | 'shipped' | undefined;
    if (dir) {
      expect(url.searchParams.get('ref')).toBe('trunk');
      const names = repo[dir];
      return names ? json([...names.map((name) => ({ name, type: 'dir' })), { name: '.gitkeep', type: 'file' }]) : json({}, 404);
    }
    if (url.pathname === '/repos/acme/widgets/issues') {
      expect(url.searchParams.get('labels')).toBe('product');
      return json(url.searchParams.get('page') === '1' ? repo.issues ?? [] : []);
    }
    if (url.pathname === '/repos/acme/widgets/pulls') return json(url.searchParams.get('page') === '1' ? repo.pulls ?? [] : []);
    const events = /^\/repos\/acme\/widgets\/issues\/(\d+)\/events$/.exec(url.pathname)?.[1];
    if (events) return json(repo.events?.[Number(events)] ?? []);
    throw new Error(`unexpected GitHub call ${href}`);
  });
  return { fetchImpl, calls };
}

describe('the stages sync reader', () => {
  it('reads the config, the folders, the labelled issues, the pull requests and the ready time of a feature PR', async () => {
    const gh = fakeGithub({
      inbox: ['0042-dark-mode'],
      shipped: ['0041-light-mode'],
      issues: [{ number: 42, created_at: '2026-09-18T00:00:00Z' }, { number: 60, created_at: '2026-09-19T00:00:00Z', pull_request: {} }],
      pulls: [
        pull(9, 'feat/dark-mode'),
        pull(10, 'feat/dark-mode--s1', { state: 'closed', merged_at: '2026-09-21T00:00:00Z', base: { ref: 'feat/dark-mode' } }),
        pull(11, 'other'),
      ],
      events: { 9: [{ event: 'convert_to_draft', created_at: '2026-09-22T00:00:00Z' }, { event: 'ready_for_review', created_at: '2026-09-23T00:00:00Z' }] },
    });
    const snap = await stagesReader(CREDS, gh.fetchImpl, () => NOW).snapshot(11, 'acme/widgets');
    expect(snap.config?.delivery).toBe('loop/delivery');
    expect(snap.inbox).toEqual(['0042-dark-mode']);
    expect(snap.shipped).toEqual(['0041-light-mode']);
    expect(snap.issues).toEqual([{ number: 42, created_at: '2026-09-18T00:00:00Z' }]);
    expect(snap.pulls.map((p) => [p.number, p.head, p.base, p.ready_at])).toEqual([
      [9, 'feat/dark-mode', 'trunk', '2026-09-23T00:00:00Z'],
      [10, 'feat/dark-mode--s1', 'feat/dark-mode', null],
      [11, 'other', 'trunk', null],
    ]);
    expect(gh.calls.filter((c) => c.includes('/events'))).toEqual(['/repos/acme/widgets/issues/9/events?per_page=100']);
  });

  it('gives an empty snapshot, and reads nothing more, for a repository without a config', async () => {
    const gh = fakeGithub({ config: null });
    const snap = await stagesReader(CREDS, gh.fetchImpl, () => NOW).snapshot(11, 'acme/widgets');
    expect(snap).toEqual({ repository: 'acme/widgets', config: null, inbox: [], shipped: [], issues: [], pulls: [] });
    expect(gh.calls.some((c) => c.includes('/pulls') || c.includes('/issues'))).toBe(false);
  });

  it('reads no folder as none', async () => {
    const snap = await stagesReader(CREDS, fakeGithub({}).fetchImpl, () => NOW).snapshot(11, 'acme/widgets');
    expect(snap.inbox).toEqual([]);
    expect(snap.shipped).toEqual([]);
  });

  it('throws when GitHub fails, naming what it read', async () => {
    const reader = stagesReader(CREDS, fakeGithub({ fail: /\/pulls/ }).fetchImpl, () => NOW);
    await expect(reader.snapshot(11, 'acme/widgets')).rejects.toThrow(/502 to \/pulls/);
  });
});
