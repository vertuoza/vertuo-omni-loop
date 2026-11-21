// @vitest-environment happy-dom
// Every dropdown of the product pages is the designed Select: picking an option calls the screen's save
// with that option's value (PRD 3129, AC-5).
import { cleanup, render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { createElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { defaultPitchSettings, type PitchSettings } from 'omni-loop/kit/lib/pitch/settings.ts';
import { LinksSection } from '../product-repositories/LinksSection';
import { PlanRepositorySection } from '../product-repositories/PlanRepositorySection';
import { demoRepositoriesTab } from '../product-repositories/RepositoriesTab';
import { initialLinksForm, initialPlanForm } from '../product-repositories/repositories-tab-model';
import type { RepositoriesTab } from '../product-repositories/repositories-tab.contract';
import { initialApproversForm, type Approvers } from './approvers';
import { ApproversSection } from './approvers-section';
import { PitchSection, type PitchHandlers } from './pitch-form';
import { initialPitchForm } from './pitch-form-model';

afterEach(cleanup);

const open = async (name: string, nth = 0) => {
  const user = userEvent.setup();
  await user.click(screen.getAllByRole('combobox', { name })[nth] ?? screen.getByRole('combobox', { name }));
  return user;
};
const pick = async (name: string, option: string, nth = 0) => {
  const user = await open(name, nth);
  await user.click(await screen.findByRole('option', { name: option }));
};

const APPROVERS: Approvers = {
  owner: true,
  members: [{ id: 'u-irisa', name: 'Irisa', login: 'irisa' }, { id: 'u-paul', name: null, login: 'paul' }, { id: 'u-dev', name: 'Dev', login: 'dev' }],
  listed: [{ id: 'u-irisa', name: 'Irisa', login: 'irisa', state: 'asked' }],
};

describe('the product pages pick with the Select (AC-5)', () => {
  it('an approver\'s state is saved with the state picked', async () => {
    const set = vi.fn<(member: string, state: string) => void>();
    render(createElement(ApproversSection, { form: initialApproversForm(APPROVERS), on: { set, remove: () => {} } }));
    await pick('Irisa', 'Skipped');
    expect(set).toHaveBeenCalledWith('u-irisa', 'skipped');
  });

  it('the member to add is added with the state asked', async () => {
    const set = vi.fn<(member: string, state: string) => void>();
    render(createElement(ApproversSection, { form: initialApproversForm(APPROVERS), on: { set, remove: () => {} } }));
    await pick('Member to add', 'Dev');
    await userEvent.setup().click(screen.getByRole('button', { name: 'Add' }));
    expect(set).toHaveBeenCalledWith('u-dev', 'asked');
  });

  it('the Pitch form saves the preset, the theme, the font source, the weight, the voice and the music picked', async () => {
    const edit = vi.fn<(draft: PitchSettings) => void>();
    const preset = vi.fn<(preset: string) => void>();
    const on: PitchHandlers = { edit, preset, upload: () => {}, save: () => {}, reset: () => {} };
    render(createElement(PitchSection, { state: initialPitchForm(defaultPitchSettings('arcade')), editable: true, on }));
    await pick('Preset', 'Clean keynote', 0);
    expect(preset).toHaveBeenCalledWith('keynote');
    await pick('Theme', 'Light');
    expect(edit.mock.lastCall?.[0].look.theme).toBe('light');
    await pick('Source', 'System font', 0);
    expect(edit.mock.lastCall?.[0].look.heading.provider).toBe('system');
    await pick('Weight', '700', 0);
    expect(edit.mock.lastCall?.[0].look.heading.weight).toBe(700);
    await pick('Preset', 'Formal', 1);
    expect(edit.mock.lastCall?.[0].voice.preset).toBe('formal');
    await pick('Source', 'Free music (FreePD, public domain)', 2);
    expect(edit.mock.lastCall?.[0].music.provider).toBe('freepd');
  });

  it('a repository link is saved with the role and the knowledge picked', async () => {
    const tab = demoRepositoriesTab('demo-product-1') as RepositoriesTab;
    const save = vi.fn<(write: { repo: string; role: string | null; knowledge: string }) => void>();
    render(createElement(LinksSection, { form: initialLinksForm(tab), owner: true, on: { save, remove: () => {} } }));
    const first = tab.links[0];
    if (first === undefined) throw new Error('no link');
    await pick('Role', 'mobile', 0);
    await pick('Knowledge', 'Imported', 0);
    await userEvent.setup().click(screen.getAllByRole('button', { name: 'Save' })[0] ?? screen.getByRole('button', { name: 'Save' }));
    expect(save).toHaveBeenCalledWith(expect.objectContaining({ repo: first.repo, role: 'mobile', knowledge: 'imported' }));
  });

  it('the repository to add is added when picked', async () => {
    const tab = demoRepositoriesTab('demo-product-1') as RepositoriesTab;
    const save = vi.fn<(write: { repo: string }) => void>();
    render(createElement(LinksSection, { form: initialLinksForm({ ...tab, addable: ['acme/billing', 'acme/scripts'] }), owner: true, on: { save, remove: () => {} } }));
    await pick('Repository to add', 'acme/scripts');
    await userEvent.setup().click(screen.getByRole('button', { name: 'Add a repository' }));
    expect(save).toHaveBeenCalledWith(expect.objectContaining({ repo: 'acme/scripts' }));
  });

  it('the plan repository is saved with the one picked, or none', async () => {
    const save = vi.fn<(repo: string | null) => void>();
    render(createElement(PlanRepositorySection, { form: initialPlanForm({ repository: 'acme/plan', holds: [] }), owner: true, repositories: ['acme/api', 'acme/plan'], on: { save } }));
    await pick('Plan repository', 'acme/api');
    await userEvent.setup().click(screen.getByRole('button', { name: 'Save' }));
    expect(save).toHaveBeenLastCalledWith('acme/api');
    await pick('Plan repository', 'None');
    await userEvent.setup().click(screen.getByRole('button', { name: 'Save' }));
    expect(save).toHaveBeenLastCalledWith(null);
  });
});
