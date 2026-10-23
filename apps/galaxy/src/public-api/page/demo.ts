import type { ApiKey } from '../keys/api-keys.contract';
import type { ApiKeysPort, GithubAppPort } from '../keys/api-keys.client';
import { makeApiKey } from '../keys/secret';
import type { ApiKeysPageView } from './model';

// Settings › API keys in the demo (PRD 2022 s1): the viewer owns the demo workspace, which holds two
// keys, and the panel keeps its changes in memory, with the database's rules (a name unique among the
// live keys, 20 at most), so the page plays as it will. The first key runs as a GitHub App, the second
// as none; an App attached here is accepted when its ID is digits and its file looks like a private key
// (the demo asks no GitHub), and refused in the server's words otherwise (PRD 2433 s5).

const DEMO_ME = { id: 'demo-me', login: 'you', name: 'You' };
const DEMO_TRACKED = ['demo-org/backend-php', 'demo-org/nimbus-apps', 'vertuoza/vertuo-omni-loop'];

/** What the server answers a pair GitHub refuses (GITHUB_REFUSED, api-keys.service.ts, held by demo.test.ts). */
const DEMO_REFUSED = 'GitHub refused this App ID and private key.';

const DEMO_KEYS: ApiKey[] = [
  {
    id: 'demo-key-1', name: 'QA dashboard', lastFour: '9fQe', repos: ['demo-org/backend-php'], createdAt: '2026-10-15T09:12:00Z',
    lastUsedAt: '2026-10-15T09:58:00Z', revokedAt: null, maker: DEMO_ME, working: true,
    githubApp: { slug: 'acme-fixer', lastTokenAt: '2026-10-14T08:00:00Z' },
  },
  {
    id: 'demo-key-2', name: 'Weekly digest', lastFour: 'A1c0', repos: [], createdAt: '2026-10-12T16:40:00Z',
    lastUsedAt: null, revokedAt: null, maker: { id: 'demo-irisa', login: 'irisa', name: 'Irisa' }, working: true, githubApp: null,
  },
];

export function demoApiKeysView(): ApiKeysPageView {
  return { kind: 'keys', source: { kind: 'demo' }, owner: true, keys: DEMO_KEYS, tracked: DEMO_TRACKED };
}

export function demoApiKeysPort(start: readonly ApiKey[], now: () => Date = () => new Date()): ApiKeysPort {
  let live = [...start];
  return {
    async make(name, repos) {
      const trimmed = name.trim();
      if (live.some((k) => k.name.toLowerCase() === trimmed.toLowerCase())) return { ok: false, message: `This workspace already has a key named “${trimmed}”. Pick another name.` };
      if (live.length >= 20) return { ok: false, message: 'This workspace holds 20 API keys already: revoke one to make another.' };
      const made = await makeApiKey();
      const key: ApiKey = {
        id: `demo-key-${String(Date.now())}`, name: trimmed, lastFour: made.lastFour, repos, createdAt: now().toISOString(),
        lastUsedAt: null, revokedAt: null, maker: DEMO_ME, working: true, githubApp: null,
      };
      live = [key, ...live];
      return { ok: true, secret: made.secret, key };
    },
    revoke(key) {
      live = live.filter((k) => k.id !== key.id);
      return Promise.resolve({ ok: true, key: { ...key, revokedAt: now().toISOString() } });
    },
  };
}

/** The demo's GitHub App calls: nothing is kept, the panel's state holds each key's App. */
export function demoGithubAppPort(): GithubAppPort {
  return {
    attach(_key, appId, privateKey) {
      const id = appId.trim();
      if (!/^[0-9]{1,15}$/.test(id) || !privateKey.includes('-----BEGIN')) return Promise.resolve({ ok: false, message: DEMO_REFUSED });
      return Promise.resolve({ ok: true, slug: `demo-app-${id}` });
    },
    remove(key) {
      return Promise.resolve({ ok: true, removed: (key.githubApp ?? null) !== null });
    },
  };
}
