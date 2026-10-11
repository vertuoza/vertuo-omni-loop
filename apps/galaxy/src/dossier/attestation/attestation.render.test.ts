import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { parsePrd } from 'vertuo-omni-plan/kit/lib/ids.ts';
import { demoAttestation } from './attestation-demo';
import { approveAgain } from './attestation.client';
import { AttestationScreenView } from './AttestationPage';

vi.mock('server-only', () => ({}));
vi.mock('next/navigation', async (original) => ({
  ...(await original<typeof import('next/navigation')>()),
  useRouter: () => ({ refresh: () => {} }),
}));

// The Attestation page as the server renders it (PRD 1612 s4), in each of the gate's four states: the
// seal, the people, the policy line, pinned vs now, the targets, and on a drift the restore command with
// Copy and Approve again.

const page = (state: string) => renderToStaticMarkup(createElement(AttestationScreenView, { screen: { kind: 'attestation', attestation: demoAttestation(state, null) } }));
const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/&#x27;/g, '\'').replace(/\s+/g, ' ');

describe('the attestation page', () => {
  it('approved: the lit seal, who approved with both ticks, every file `=`, the targets and the policy', () => {
    const html = page('approved');
    expect(html).toContain('data-verdict="approved"');
    const words = text(html);
    expect(words).toContain('Approved · pinned');
    expect(words).toContain('irisa · member of vertuoza ✓ · Mobile approver ✓ · 8 Oct 2026, 14:02 UTC');
    expect(words).toContain('Pinned vs head 4f1a2c0');
    expect(html.match(/data-mark="matches"/g)?.length).toBe(4);
    expect(words).toContain('vertuoza/vertuo-api #446 approved');
    expect(words).toContain('Policy: Mobile approvers · vertuoza members.');
    expect(words).not.toContain('Fix it');
  });

  it('drifted: the seal stands, both hashes, the restore command with Copy and Approve again', () => {
    const html = page('drifted');
    const words = text(html);
    expect(words).toContain('Seal stands · build refused');
    expect(words).toContain('plan.md changed at head 4f1a2c0 · whitespace only');
    expect(html).toContain('data-mark="differs"');
    expect(words).toMatch(/plan\.md \S+…\S+ → \S+…\S+ · whitespace only/);
    expect(words).toContain('omni approval restore 918');
    expect(words).toContain('Copy');
    expect(words).toContain('Approve again');
    expect(words).toContain('vertuoza/vertuo-api #446 drifted');
  });

  it('waiting: nobody approved yet, nothing pinned, the way to the PRD', () => {
    const words = text(page('waiting'));
    expect(words).toContain('Waits for approval');
    expect(words).toContain('Nobody approved PRD 918 yet.');
    expect(words).toContain('Nothing pinned yet.');
    expect(words).toContain('Open the PRD to approve it');
  });

  it('held: every file `?`, never failed', () => {
    const html = page('held');
    expect(text(html)).toContain('Held · not failed');
    expect(text(html)).toContain('could not be read on GitHub: held, not failed.');
    expect(html.match(/data-mark="unread"/g)?.length).toBe(4);
  });

  it('a PRD approved in its repository says it has none', () => {
    const html = renderToStaticMarkup(createElement(AttestationScreenView, { screen: { kind: 'repo-born', prd: parsePrd(918), page: '/prd/x' } }));
    expect(text(html)).toContain('No attestation for this PRD');
  });
});

describe('Approve again', () => {
  it('approves through the PRD page\'s route, and says the route\'s refusal in its words', async () => {
    const send = vi.fn(() => Promise.resolve(new Response('{}', { status: 200 })));
    expect(await approveAgain('d1', send)).toBeNull();
    expect(send).toHaveBeenCalledWith('/api/dossiers/approval', expect.objectContaining({ method: 'POST', body: JSON.stringify({ dossier: 'd1' }) }));
    expect(await approveAgain('d1', () => Promise.resolve(Response.json({ error: 'Only a Mobile approver may approve.' }, { status: 403 })))).toBe('Only a Mobile approver may approve.');
    expect(await approveAgain('d1', () => Promise.resolve(new Response('', { status: 500 })))).toBe('The PRD was not approved (500). Try again.');
    expect(await approveAgain('d1', () => Promise.reject(new Error('offline')))).toBe('The PRD was not approved. Check your connection and try again.');
  });
});
