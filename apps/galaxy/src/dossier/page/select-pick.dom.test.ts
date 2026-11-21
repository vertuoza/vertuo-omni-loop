// @vitest-environment happy-dom
// Every dropdown of the dossier page is the designed Select: picking an option calls the screen's save
// with that option's value, and the forms still post name=value (PRD 3129, AC-5).
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { createElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DossierHistory } from './DossierHistory';
import { PitchPane } from './PitchPane';
import { ProductField } from './ProductPicker';
import { RequestTechApproval } from './RequestTechApproval';
import { VersionPicker } from './VersionPicker';
import type { PitchAudienceView } from './pitch';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: () => {} }) }));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const pick = async (name: string, option: string) => {
  const user = userEvent.setup();
  await user.click(screen.getByRole('combobox', { name }));
  await user.click(await screen.findByRole('option', { name: option }));
};

describe('the dossier page picks with the Select (AC-5)', () => {
  it('the version picker lists every version and submits its form with the one picked', async () => {
    const submit = vi.spyOn(HTMLFormElement.prototype, 'requestSubmit').mockImplementation(() => {});
    const versions = [
      { id: 'a', number: 2, label: 'v2 · 28 Sep', href: '#', current: true, frame: null },
      { id: 'b', number: 1, label: 'v1 · 27 Sep', href: '#', current: false, frame: null },
    ];
    const { container } = render(createElement(VersionPicker, { action: '/prd/x', tab: 'spec', versions, shown: 2 }));
    const form = container.querySelector('form');
    if (form === null) throw new Error('no form');
    expect(new FormData(form).get('v')).toBe('2');
    await pick('Version', 'v1 · 27 Sep');
    expect(new FormData(form).get('v')).toBe('1');
    await waitFor(() => { expect(submit).toHaveBeenCalled(); });
  });

  it('the pitch picker posts the pitch picked and submits its form', async () => {
    const submit = vi.spyOn(HTMLFormElement.prototype, 'requestSubmit').mockImplementation(() => {});
    const audience: PitchAudienceView = {
      audience: 'customers', label: 'Customers', id: 'p2', at: '1 Oct 2026', look: 'Arcade poster', commit: 'a1b2c3d', kicker: 'NEW', hook: 'h', benefit: 'b', closing: 'c',
      slide: null, video: null, downloads: [], gif: '/api/pitches/p2/pitch.gif',
      versions: [{ id: 'p2', label: '1 Oct · Arcade poster', current: true }, { id: 'p1', label: '30 Sep · Clean keynote', current: false }],
    };
    const { container } = render(createElement(PitchPane, { pitch: { audiences: [audience] }, action: '/prd/x' }));
    const form = container.querySelector('form');
    if (form === null) throw new Error('no form');
    expect(new FormData(form).get('pitch')).toBe('p2');
    await pick('Pitch', '30 Sep · Clean keynote');
    expect(new FormData(form).get('pitch')).toBe('p1');
    await waitFor(() => { expect(submit).toHaveBeenCalled(); });
  });

  it('the history filters post the repository picked', async () => {
    const { container } = render(createElement(DossierHistory, { items: [], choices: { repos: ['demo-org/nimbus-core', 'vertuoza/vertuo-omni-loop'] }, filters: { who: 'mine', repo: 'demo-org/nimbus-core' } }));
    const form = container.querySelector('form');
    if (form === null) throw new Error('no form');
    expect(new FormData(form).get('repo')).toBe('demo-org/nimbus-core');
    await pick('Repository', 'vertuoza/vertuo-omni-loop');
    expect(new FormData(form).get('repo')).toBe('vertuoza/vertuo-omni-loop');
  });

  it('the product picker offers No product first and saves the product picked', async () => {
    const onPick = vi.fn<(product: string | null) => void>();
    const products = [{ id: 'p-1', name: 'Estimates' }, { id: 'p-2', name: 'Mobile' }];
    render(createElement(ProductField, { pick: { product: products[1] ?? null, products, locked: null }, busy: false, problem: null, onPick }));
    const user = userEvent.setup();
    await user.click(screen.getByRole('combobox', { name: 'Product' }));
    expect((await screen.findAllByRole('option')).map((o) => o.textContent)).toEqual(['No product', 'Estimates', 'Mobile']);
    await user.click(screen.getByRole('option', { name: 'Estimates' }));
    expect(onPick).toHaveBeenCalledWith('p-1');
    await pick('Product', 'No product');
    expect(onPick).toHaveBeenLastCalledWith(null);
  });

  it('the Tech Approval picker asks the member picked', async () => {
    const fetched = vi.fn<(url: string, init?: { method?: string; body?: string }) => Promise<Response>>((_url, init) => Promise.resolve(
      init?.method === 'POST'
        ? new Response('{}', { status: 200 })
        : new Response(JSON.stringify({ members: [{ login: 'irisa', name: 'Irisa' }, { login: 'dev', name: null }] }), { status: 200 }),
    ));
    vi.stubGlobal('fetch', fetched);
    render(createElement(RequestTechApproval, { dossier: 'd-1' }));
    await waitFor(() => { expect(screen.getByRole('combobox', { name: 'Who should give the Tech Approval' }).hasAttribute('disabled')).toBe(false); });
    await pick('Who should give the Tech Approval', 'Irisa (@irisa)');
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Request a Tech Approval' }));
    await waitFor(() => { expect(fetched.mock.calls.some(([, init]) => init?.method === 'POST' && init.body === JSON.stringify({ dossier: 'd-1', login: 'irisa' }))).toBe(true); });
  });
});
