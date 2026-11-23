// @vitest-environment happy-dom
// Every dropdown of the Ask page and of the questions card is the designed Select: picking an option
// calls the screen's save with that option's value, and the history's filters still post name=value
// (PRD 3129, AC-5).
import { cleanup, render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { createElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Category } from '../classify';
import type { ClaimKind } from '../../business/model';
import { QuestionsCard } from '../../agent-connect/questions/QuestionsCard';
import type { QuestionsHandlers } from '../../agent-connect/questions/QuestionsCard';
import type { QuestionsState } from '../../agent-connect/questions/state';
import { CategoryChip } from './CategoryChip';
import { ShareButton } from './ShareButton';
import { WorkspaceHistory } from './WorkspaceHistory';

afterEach(cleanup);

describe('the Ask page and the questions card pick with the Select (AC-5)', () => {
  it('the category chip saves the category picked', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn<(category: Category | null) => void>();
    render(createElement(CategoryChip, { chip: { value: 'ux-ui', label: 'UX/UI', setBy: null }, onChange }));
    await user.click(screen.getByRole('combobox', { name: 'Category' }));
    await user.click(await screen.findByRole('option', { name: 'Product' }));
    expect(onChange).toHaveBeenCalledWith('product');
  });

  it('the category chip saves null for unsorted', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn<(category: Category | null) => void>();
    render(createElement(CategoryChip, { chip: { value: 'ux-ui', label: 'UX/UI', setBy: null }, onChange }));
    await user.click(screen.getByRole('combobox', { name: 'Category' }));
    await user.click(await screen.findByRole('option', { name: 'unsorted' }));
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it('the share picker shares with the member picked', async () => {
    const user = userEvent.setup();
    const onShare = vi.fn<(member: string) => Promise<boolean>>(() => Promise.resolve(true));
    const candidates = [{ id: 'po', label: 'PAULA' }, { id: 'ux', label: 'uma@example.com' }];
    render(createElement(ShareButton, { roundId: 'r1', candidates, onShare, origin: 'https://galaxy.example', initial: { kind: 'picking' } }));
    await user.click(screen.getByRole('combobox', { name: 'Share with' }));
    await user.click(await screen.findByRole('option', { name: 'uma@example.com' }));
    await user.click(screen.getByRole('button', { name: 'Share' }));
    expect(onShare).toHaveBeenCalledWith('ux');
  });

  it('the history filters keep the category and post the repository picked', async () => {
    const user = userEvent.setup();
    const choices = { repos: ['demo-org/nimbus-app', 'demo-org/nimbus-api'], prds: [], skills: [], askedBy: [], answeredBy: [] };
    const { container } = render(createElement(WorkspaceHistory, { items: [], choices, filters: { category: 'product', repo: 'demo-org/nimbus-app' } }));
    const form = container.querySelector('form');
    if (form === null) throw new Error('no form');
    expect(new FormData(form).get('category')).toBe('product');
    expect(new FormData(form).get('repo')).toBe('demo-org/nimbus-app');
    await user.click(screen.getByRole('combobox', { name: 'Repository' }));
    await user.click(await screen.findByRole('option', { name: 'demo-org/nimbus-api' }));
    expect(new FormData(form).get('repo')).toBe('demo-org/nimbus-api');
  });

  it('the questions card saves the kind and the product picked', async () => {
    const user = userEvent.setup();
    const kind = vi.fn<(kind: ClaimKind) => void>();
    const product = vi.fn<(product: string) => void>();
    const on: QuestionsHandlers = { answer: vi.fn(), kind: (k) => { kind(k); }, value: vi.fn(), product: (p) => { product(p); }, save: vi.fn(), cancel: vi.fn(), dismiss: vi.fn(), bringBack: vi.fn() };
    const state: QuestionsState = {
      questions: [{ id: 'q1', question: 'Who do we sell to?', asked: 1, askedBy: 'Tom', repo: null, file: null, firstAskedAt: '2026-09-26T09:00:00Z', lastAskedAt: '2026-09-26T09:00:00Z', product: null }],
      answering: { id: 'q1', kind: 'offering', value: '', product: null },
      busy: false, refusal: null, done: null,
    };
    const products = [{ id: 'p1', name: 'Alpha' }, { id: 'p2', name: 'Beta' }];
    render(createElement(QuestionsCard, { state, products, on }));
    await user.click(screen.getByRole('combobox', { name: 'Kind' }));
    await user.click(await screen.findByRole('option', { name: 'Never' }));
    expect(kind).toHaveBeenCalledWith('never');
    await user.click(screen.getByRole('combobox', { name: 'Product' }));
    await user.click(await screen.findByRole('option', { name: 'Beta' }));
    expect(product).toHaveBeenCalledWith('p2');
  });
});
