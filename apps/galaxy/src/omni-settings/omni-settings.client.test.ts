import { describe, expect, it } from 'vitest';
import { COULD_NOT_PROPOSE, demoProposal, proposePage } from './omni-settings.client';
import { PLAYBOOK_PROPOSAL_ROUTE } from './omni-settings.contract';

// Settings → Playbook's call from the browser (PRD 2417, s7), against a fake fetch: the change posted
// to the proposal route, the pull request it answered, the route's own words for a refusal, and one
// line when the answer is no answer at all.

const EDIT = { workspace: 'w-acme', form: 'review', text: '# Review\n' };
const OPENED = { repository: 'acme/plan', pullRequest: { number: 42, url: 'https://github.com/acme/plan/pull/42' } };

function fetchAnswering(answer: () => Response) {
  const sent: { url: string; init: RequestInit }[] = [];
  const fetch = (url: string | URL | Request, init?: RequestInit) => {
    sent.push({ url: String(url), init: init ?? {} });
    return Promise.resolve(answer());
  };
  return { fetch: fetch as typeof globalThis.fetch, sent };
}

describe('proposePage', () => {
  it('posts the change to the proposal route and answers the pull request opened', async () => {
    const { fetch, sent } = fetchAnswering(() => Response.json(OPENED));
    expect(await proposePage(EDIT, fetch)).toEqual({ ok: true, proposed: OPENED });
    expect(sent).toHaveLength(1);
    expect(sent[0]?.url).toBe(PLAYBOOK_PROPOSAL_ROUTE);
    expect(sent[0]?.init.method).toBe('POST');
    expect(JSON.parse(String(sent[0]?.init.body))).toEqual(EDIT);
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
