// @vitest-environment happy-dom
// Every dropdown of the other app pages is the designed Select: picking an option calls the screen's save
// (or puts the option's value in the form it posts) with that option's value (PRD 3129, AC-5).
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { createElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { parsePrd } from 'omni-loop/kit/lib/ids.ts';
import { PERSONA_TRADES } from '@omni/design';
import { Drawer, type PersonaHandlers } from '../business/PersonasSection';
import { initialPersonasState, personasReducer } from '../business/personas';
import { FixList } from '../fixes/FixList';
import type { JevKeyStatus } from '../jev/store';
import { JevView } from '../jev/settings/JevView';
import { initialState } from '../jev/settings/model';
import { RepoPicker } from '../knowledge/RepoPicker';
import { MissionsTab } from '../missions/page/MissionsTab';
import { demoMissionsPort } from '../missions/page/missions-tab.client';
import { missionOf, type MissionRow } from '../missions/page/missions-tab';
import { SettingsRepositoryLine } from '../omni-settings/SettingsRepositoryLine';
import { TerminalTokensCard } from '../profile/TerminalTokensCard';
import { initialTerminalState } from '../profile/terminal-tokens';
import { FleetPicker } from '../runners/page/actions';
import { demoKnowledgeTab } from './KnowledgeTab';
import { SectionTop } from './KnowledgeTabPage';
import { AddQuestion } from './search/eval/EvalControls';
import type { KnowledgeTab } from './product-knowledge.contract';

const calls = vi.hoisted(() => ({
  setRunnerFleet: vi.fn<(runner: string, fleet: string | null) => Promise<{ ok: true; value: object }>>(),
  addEvalQuestion: vi.fn<(product: string, question: string, category: string | null) => Promise<{ ok: true }>>(),
}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: () => undefined, push: () => undefined }) }));
vi.mock('../runners/runners.client', () => ({
  setRunnerFleet: calls.setRunnerFleet, cancelRunnerJob: () => Promise.resolve({ ok: true }), sendToRunner: () => Promise.resolve({ ok: true }),
}));
vi.mock('../runners/page/fix.client', () => ({ postFixWithAnswers: () => Promise.resolve({ ok: true }) }));
vi.mock('../product-knowledge/search/eval/eval-actions', () => ({
  addEvalQuestion: calls.addEvalQuestion, removeEvalQuestion: () => Promise.resolve({ ok: true }), setEvalAnswer: () => Promise.resolve({ ok: true }),
}));

afterEach(() => { cleanup(); vi.clearAllMocks(); });

const pick = async (name: string, option: string, nth = 0) => {
  const user = userEvent.setup();
  await user.click(screen.getAllByRole('combobox', { name })[nth] ?? screen.getByRole('combobox', { name }));
  await user.click(await screen.findByRole('option', { name: option }));
  return user;
};
const optionsOf = async (name: string) => {
  await userEvent.setup().click(screen.getByRole('combobox', { name }));
  return screen.getAllByRole('option').map((option) => option.textContent);
};
const formData = (container: HTMLElement) => {
  const form = container.querySelector('form');
  if (form === null) throw new Error('no form');
  return new FormData(form);
};

describe('the other app pages pick with the Select (AC-5)', () => {
  it('the runners page saves the fleet picked, Shared meaning none', async () => {
    calls.setRunnerFleet.mockResolvedValue({ ok: true, value: {} });
    render(createElement(FleetPicker, { runner: 'r-1', name: 'acme-agents', value: 'comets', options: [{ value: '', label: 'Shared' }, { value: 'comets', label: 'Comets' }, { value: 'nebula', label: 'Nebula' }] }));
    await pick('Fleet of acme-agents', 'Nebula');
    await waitFor(() => { expect(calls.setRunnerFleet).toHaveBeenCalledWith('r-1', 'nebula'); });
    await pick('Fleet of acme-agents', 'Shared');
    await waitFor(() => { expect(calls.setRunnerFleet).toHaveBeenLastCalledWith('r-1', null); });
  });

  it('the Eval view adds a question with the category picked', async () => {
    calls.addEvalQuestion.mockResolvedValue({ ok: true });
    render(createElement(AddQuestion, { product: 'p-1', categories: [{ key: 'rules', label: 'Rules' }, { key: 'words', label: 'Words' }] }));
    const user = await pick('Category', 'Words');
    await user.type(screen.getByPlaceholderText('what an agent would ask'), 'What is a law?');
    await user.click(screen.getByRole('button', { name: 'Add question' }));
    await waitFor(() => { expect(calls.addEvalQuestion).toHaveBeenCalledWith('p-1', 'What is a law?', 'words'); });
  });

  it('the Knowledge tab names the owner and the delegate picked', async () => {
    const tab = demoKnowledgeTab('demo-product-1') as KnowledgeTab;
    const members = [{ id: 'u-anna', login: 'anna' }, { id: 'u-dev', login: 'dev' }];
    render(createElement(SectionTop, { product: 'demo-product-1', source: { kind: 'demo' }, kind: 'legal', section: { ...tab.legal, owner: { user: 'u-anna', login: 'anna' }, delegate: null }, members, canName: true }));
    expect(await optionsOf('Owner')).toEqual(['Nobody', '@anna', '@dev']);
    await userEvent.setup().keyboard('{Escape}');
    await pick('Delegate', '@dev');
    expect(screen.getByRole('combobox', { name: 'Delegate' }).textContent).toContain('@dev');
    expect(screen.getByRole('combobox', { name: 'Owner' }).textContent).toContain('@anna');
  });

  it('a persona\'s trade is changed with the trade picked, Other… opening its own field', async () => {
    const change = vi.fn<PersonaHandlers['change']>();
    const on: PersonaHandlers = { open: () => {}, edit: () => {}, change, shuffle: () => {}, close: () => {}, save: () => {}, remove: () => {}, undo: () => {} };
    const state = personasReducer(initialPersonasState([]), { type: 'new', product: 'p-1', seed: 'a' });
    render(createElement(Drawer, { state, on }));
    const trade = PERSONA_TRADES[1];
    if (trade === undefined) throw new Error('no trade');
    await pick('Trade', trade.label);
    expect(change).toHaveBeenLastCalledWith({ trade: trade.id }, false);
    await pick('Trade', 'Other…');
    expect(change).toHaveBeenLastCalledWith({ trade: '' }, true);
  });

  it('Jev saves the mode picked, and offers Off alone while no key is stored', async () => {
    const saveDecision = vi.fn();
    const decisions = [{ decision: 'question-category' as const, mode: 'off' as const, threshold: 0.5, floor: 0.5 }];
    const on = { edit: () => {}, cancel: () => {}, save: () => {}, remove: () => {}, saveDecision };
    const stored: JevKeyStatus = { stored: true, lastFour: '1a2b', setAt: '2026-09-30T10:00:00Z' };
    const view = (key: JevKeyStatus) => createElement(JevView, { state: initialState(key, decisions), owner: true, on });
    const { container, unmount } = render(view({ stored: false, lastFour: null, setAt: null }));
    const rowOf = (root: HTMLElement) => within(root.querySelector('[data-decision="question-category"]') as HTMLElement);
    await userEvent.setup().click(rowOf(container).getByRole('combobox', { name: 'Mode' }));
    expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual(['Off']);
    await userEvent.setup().keyboard('{Escape}');
    unmount();
    const keyed = render(view(stored));
    const row = rowOf(keyed.container);
    await userEvent.setup().click(row.getByRole('combobox', { name: 'Mode' }));
    await userEvent.setup().click(await screen.findByRole('option', { name: 'Shadow' }));
    expect(row.getByRole('combobox', { name: 'Mode' }).textContent).toContain('Shadow');
    fireEvent.submit(row.getByRole('button', { name: 'Save' }).closest('form') as HTMLFormElement);
    expect(saveDecision).toHaveBeenCalledWith(expect.objectContaining({ decision: 'question-category', mode: 'shadow' }));
  });

  it('the settings repository line saves the repository picked', async () => {
    const choice = { chosen: null, plan: null, listed: ['acme/app', 'acme/plans'] };
    render(createElement(SettingsRepositoryLine, { choice, editing: { kind: 'demo' } }));
    expect(await optionsOf('Settings repository')).toEqual(['acme/app', 'acme/plans']);
    await userEvent.setup().keyboard('{Escape}');
    const user = await pick('Settings repository', 'acme/plans');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('acme/plans')).toBeTruthy();
  });

  it('the token form posts the days picked', async () => {
    const { container } = render(createElement(TerminalTokensCard, {
      state: initialTerminalState({ tokens: [], live: 0 }), workspace: 'vertuoza', back: '/app/people/ada', now: Date.now(),
    }));
    expect(formData(container).get('days')).toBe('90');
    await pick('Expires in', '365 days');
    expect(formData(container).get('days')).toBe('365');
  });

  it('the fixes list filters by the state and the repository picked', async () => {
    const { container } = render(createElement(FixList, { kind: 'bug', items: [], choices: { repos: ['acme/api', 'acme/web'] }, filters: { who: 'mine' } }));
    expect(formData(container).get('state')).toBe('');
    await pick('State', 'Merged');
    await pick('Repository', 'acme/web');
    const data = formData(container);
    expect(data.get('state')).toBe('merged');
    expect(data.get('repo')).toBe('acme/web');
  });

  it('the knowledge map opens the repository picked', async () => {
    const assign = vi.fn<(url: string) => void>();
    vi.stubGlobal('location', { assign });
    render(createElement(RepoPicker, { menu: { options: [{ value: '', label: 'acme/widgets' }, { value: 'acme/Anvils', label: 'acme/Anvils' }], current: '' } }));
    await pick('Repository', 'acme/Anvils');
    expect(assign).toHaveBeenCalledWith('/knowledge?repo=acme%2FAnvils');
    vi.unstubAllGlobals();
  });

  it('a mission at draft saves the level picked', async () => {
    const setLevel = vi.fn<(mission: string, level: string) => Promise<{ ok: true }>>(() => Promise.resolve({ ok: true }));
    const row: MissionRow = {
      id: '22222222-2222-4222-8222-222222222222', repo: 'acme/shop', number: 40, title: 'Pay online', goal: 'Every quote can be paid online.', status: 'draft', waitingOn: null,
      prds: [parsePrd(1), parsePrd(2)], level: 'own-branch', inPlan: false,
    };
    const view = { workspace: '11111111-1111-4111-8111-111111111111', fleet: 'night-shift', missions: [missionOf(row, [])] };
    render(createElement(MissionsTab, { view, port: { ...demoMissionsPort, setLevel: setLevel } }));
    await userEvent.setup().click(screen.getByRole('combobox', { name: 'Change for this mission' }));
    const levels = screen.getAllByRole('option').map((option) => option.textContent);
    const other = levels.find((label) => label !== 'Own branch');
    if (other === undefined) throw new Error('only one level');
    await userEvent.setup().click(screen.getByRole('option', { name: other }));
    await waitFor(() => { expect(setLevel).toHaveBeenCalledWith(row.id, expect.any(String)); });
  });
});
