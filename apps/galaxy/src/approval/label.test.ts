import { generateKeyPairSync } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { approvedLabeler, approvedUnlabeler } from './label';

vi.mock('server-only', () => ({}));

// The approved label (PRD 1299 s2), against a stubbed GitHub: once a PRD is approved, the omni-loop App
// adds the repository's `labels.approved` (omni:approved unless its config says otherwise) to the PRD's
// issue. Nothing reads the label; it is for display.

const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const CREDS = { appId: '42', privateKey: privateKey.export({ type: 'pkcs1', format: 'pem' }).toString() };
const NOW = Date.parse('2026-10-09T10:00:00Z');

type Call = { method: string; url: string; body: unknown };

function github({ installed = true, config = null as string | null, labels = 200, removed = 200 } = {}) {
  const calls: Call[] = [];
  const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
  const routes: Array<[(url: string) => boolean, () => Response]> = [
    [(url) => url.endsWith('/installation'), () => (installed ? json(200, { id: 7, account: { login: 'acme', type: 'Organization' } }) : json(404, {}))],
    [(url) => url.endsWith('/access_tokens'), () => json(201, { token: 'inst-token', expires_at: '2026-10-09T11:00:00Z' })],
    [(url) => url.includes('/contents/'), () => (config === null ? json(404, {}) : new Response(config, { status: 200 }))],
    [(url) => url.endsWith('/labels'), () => json(labels, labels === 200 ? [{ name: 'omni:approved' }] : { message: 'nope' })],
    [(url) => url.includes('/labels/'), () => json(removed, removed === 200 ? [] : { message: 'nope' })],
  ];
  const fetch = (url: string, init: RequestInit = {}) => {
    calls.push({ method: init.method ?? 'GET', url, body: typeof init.body === 'string' ? JSON.parse(init.body) as unknown : null });
    const answer = routes.find(([matches]) => matches(url))?.[1] ?? (() => json(500, {}));
    return Promise.resolve(answer());
  };
  const label = approvedLabeler({ creds: CREDS, fetch, store: null, clock: () => NOW });
  const unlabel = approvedUnlabeler({ creds: CREDS, fetch, store: null, clock: () => NOW });
  return { calls, label, unlabel };
}

describe('the approved label', () => {
  it("adds omni:approved to the PRD's issue, as the App's installation", async () => {
    const g = github();
    await g.label('acme/widgets', 1299 as never);
    const add = g.calls.at(-1);
    expect(add).toEqual({ method: 'POST', url: 'https://api.github.com/repos/acme/widgets/issues/1299/labels', body: { labels: ['omni:approved'] } });
    expect(g.calls.map((c) => c.url)).toEqual([
      'https://api.github.com/repos/acme/widgets/installation',
      'https://api.github.com/app/installations/7/access_tokens',
      'https://api.github.com/repos/acme/widgets/contents/.omni-loop/config.yml',
      'https://api.github.com/repos/acme/widgets/issues/1299/labels',
    ]);
  });

  it("adds the label the repository's config names", async () => {
    const g = github({ config: 'kit: 1\nlabels:\n  approved: "phase0:approved"\n' });
    await g.label('acme/widgets', 1299 as never);
    expect(g.calls.at(-1)?.body).toEqual({ labels: ['phase0:approved'] });
  });

  it('falls back to omni:approved when the config cannot be read as one', async () => {
    const g = github({ config: 'labels: [not, a, section' });
    await g.label('acme/widgets', 1299 as never);
    expect(g.calls.at(-1)?.body).toEqual({ labels: ['omni:approved'] });
  });

  it('adds nothing where the App is not installed', async () => {
    const g = github({ installed: false });
    await g.label('acme/widgets', 1299 as never);
    expect(g.calls.map((c) => c.method)).toEqual(['GET']);
  });

  it('throws when GitHub refuses the label, naming its answer', async () => {
    await expect(github({ labels: 422 }).label('acme/widgets', 1299 as never)).rejects.toThrow('GitHub answered 422');
  });
});

// PRD 1612 s2: voiding an approval removes the label again, as the App's installation, so the App's
// `issues.unlabeled` webhook reruns the omni/approved check on the PRD's open pull requests.
describe('the approved label, removed', () => {
  it("removes omni:approved from the PRD's issue, as the App's installation", async () => {
    const g = github();
    await g.unlabel('acme/widgets', 1612 as never);
    expect(g.calls.map((c) => `${c.method} ${c.url}`)).toEqual([
      'GET https://api.github.com/repos/acme/widgets/installation',
      'POST https://api.github.com/app/installations/7/access_tokens',
      'GET https://api.github.com/repos/acme/widgets/contents/.omni-loop/config.yml',
      'DELETE https://api.github.com/repos/acme/widgets/issues/1612/labels/omni%3Aapproved',
    ]);
  });

  it("removes the label the repository's config names", async () => {
    const g = github({ config: 'kit: 1\nlabels:\n  approved: "phase0:approved"\n' });
    await g.unlabel('acme/widgets', 1612 as never);
    expect(g.calls.at(-1)?.url).toBe('https://api.github.com/repos/acme/widgets/issues/1612/labels/phase0%3Aapproved');
  });

  it('is done when the issue no longer carries the label', async () => {
    await expect(github({ removed: 404 }).unlabel('acme/widgets', 1612 as never)).resolves.toBeUndefined();
  });

  it('removes nothing where the App is not installed', async () => {
    const g = github({ installed: false });
    await g.unlabel('acme/widgets', 1612 as never);
    expect(g.calls.map((c) => c.method)).toEqual(['GET']);
  });

  it('throws when GitHub refuses the removal, naming its answer', async () => {
    await expect(github({ removed: 403 }).unlabel('acme/widgets', 1612 as never)).rejects.toThrow('GitHub answered 403');
  });
});
