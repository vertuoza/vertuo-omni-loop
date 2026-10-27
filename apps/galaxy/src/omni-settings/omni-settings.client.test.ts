import { describe, expect, it } from 'vitest';
import { COULD_NOT_CHOOSE, COULD_NOT_PROPOSE, chooseRepository, demoChoice, demoProposal, proposePage } from './omni-settings.client';
import { PLAYBOOK_PROPOSAL_ROUTE, SETTINGS_REPOSITORY_ROUTE } from './omni-settings.contract';

// Settings → Playbook's call from the browser (PRD 2417, s7), against a fake fetch: the change posted
// to the proposal route, the pull request it answered, the route's own words for a refusal, and one
// line when the answer is no answer at all.

const EDIT = { workspace: 'w-acme', form: 'review', text: '# Review\n' };
const OPENED = { repository: 'acme/plan', pullRequest: { number: 42, url: 'https://github.com/acme/plan/pull/42' } };

function fetchAnswering(answer: () => Response) {
  const sent: { url: unknown; init: RequestInit }[] = [];
  const fetch: typeof globalThis.fetch = (url, init) => {
    sent.push({ url, init: init ?? {} });
    return Promise.resolve(answer());
  };
  return { fetch, sent };
}

describe('proposePage', () => {
  it('posts the change to the proposal route and answers the pull request opened', async () => {
    const { fetch, sent } = fetchAnswering(() => Response.json(OPENED));
    expect(await proposePage(EDIT, fetch)).toEqual({ ok: true, proposed: OPENED });
    expect(sent).toHaveLength(1);
    expect(sent[0]?.url).toBe(PLAYBOOK_PROPOSAL_ROUTE);
    expect(sent[0]?.init.method).toBe('POST');
    const body = sent[0]?.init.body;
    expect(typeof body === 'string' ? JSON.parse(body) : null).toEqual(EDIT);
  });

  it('answers the route\'s own words for a refusal', async () => {
    const { fetch } = fetchAnswering(() => Response.json({ error: 'Only an owner of the workspace can change its playbook.' }, { status: 403 }));
    expect(await proposePage(EDIT, fetch)).toEqual({ ok: false, message: 'Only an owner of the workspace can change its playbook.' });
  });

  it('answers one line when the answer is not the route\'s, or the network fails', async () => {
    expect(await proposePage(EDIT, fetchAnswering(() => new Response('<html>', { status: 502 })).fetch)).toEqual({ ok: false, message: COULD_NOT_PROPOSE });
    expect(await proposePage(EDIT, fetchAnswering(() => Response.json({ odd: true })).fetch)).toEqual({ ok: false, message: COULD_NOT_PROPOSE });
    const failing = (() => Promise.reject(new Error('offline'))) as typeof globalThis.fetch;
    expect(await proposePage(EDIT, failing)).toEqual({ ok: false, message: COULD_NOT_PROPOSE });
  });
});

describe('demoProposal', () => {
  it('answers a pull request of the demo\'s settings repository, opened nowhere', () => {
    expect(demoProposal('acme/plans')).toEqual({ ok: true, proposed: { repository: 'acme/plans', pullRequest: { number: 1, url: 'https://github.com/acme/plans/pulls' } } });
  });
});

describe('chooseRepository (PRD 2543, s3)', () => {
  const bodyOf = (init: RequestInit | undefined): unknown => (typeof init?.body === 'string' ? JSON.parse(init.body) : null);

  it('posts the repository chosen (Keep it, or Save) to the settings-repository route and answers the stored name', async () => {
    const { fetch, sent } = fetchAnswering(() => Response.json({ repository: 'acme/plans' }));
    expect(await chooseRepository({ workspace: 'w-acme', repository: 'acme/plans' }, fetch)).toEqual({ ok: true, repository: 'acme/plans' });
    expect(sent).toHaveLength(1);
    expect(sent[0]?.url).toBe(SETTINGS_REPOSITORY_ROUTE);
    expect(sent[0]?.init.method).toBe('POST');
    expect(bodyOf(sent[0]?.init)).toEqual({ workspace: 'w-acme', repository: 'acme/plans' });
  });

  it('posts a null repository to clear the choice (Clear the choice) and answers null', async () => {
    const { fetch, sent } = fetchAnswering(() => Response.json({ repository: null }));
    expect(await chooseRepository({ workspace: 'w-acme', repository: null }, fetch)).toEqual({ ok: true, repository: null });
    expect(bodyOf(sent[0]?.init)).toEqual({ workspace: 'w-acme', repository: null });
  });

  it('answers the route\'s own words for a refusal, the member\'s 403 and the removed repository\'s 404', async () => {
    const forbidden = fetchAnswering(() => Response.json({ error: 'Only the workspace’s owner can change it.' }, { status: 403 })).fetch;
    expect(await chooseRepository({ workspace: 'w-acme', repository: 'acme/plans' }, forbidden)).toEqual({ ok: false, message: 'Only the workspace’s owner can change it.' });
    const gone = fetchAnswering(() => Response.json({ error: 'That repository is no longer in this workspace. Reload the page.' }, { status: 404 })).fetch;
    expect(await chooseRepository({ workspace: 'w-acme', repository: 'acme/old' }, gone)).toEqual({
      ok: false, message: 'That repository is no longer in this workspace. Reload the page.',
    });
  });

  it('answers one line when the answer is not the route\'s, or the network fails', async () => {
    const choice = { workspace: 'w-acme', repository: 'acme/plans' };
    expect(await chooseRepository(choice, fetchAnswering(() => new Response('<html>', { status: 502 })).fetch)).toEqual({ ok: false, message: COULD_NOT_CHOOSE });
    expect(await chooseRepository(choice, fetchAnswering(() => Response.json({ odd: true })).fetch)).toEqual({ ok: false, message: COULD_NOT_CHOOSE });
    const failing: typeof globalThis.fetch = () => Promise.reject(new Error('offline'));
    expect(await chooseRepository(choice, failing)).toEqual({ ok: false, message: COULD_NOT_CHOOSE });
  });
});

describe('demoChoice', () => {
  it('answers the choice as given, stored nowhere', () => {
    expect(demoChoice('acme/plans')).toEqual({ ok: true, repository: 'acme/plans' });
    expect(demoChoice(null)).toEqual({ ok: true, repository: null });
  });
});
