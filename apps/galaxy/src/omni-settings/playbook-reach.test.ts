import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { SETTINGS_TABS } from '../nav/section-tabs';
import { SETTINGS } from '../nav/sidebar';
import type { SettingsFile } from './omni-settings.contract';
import type { SettingsWorkspace } from './omni-settings.repository';
import { omniSettingsPagesService, type SettingsGithub } from './omni-settings.service';
import { PLAYBOOK_PATH, PlaybookScreen } from './PlaybookScreen';

// Issue 2538: Settings › Playbook (PRD 2417) is reached from the Settings tabs and from the menu's
// Settings entry, as every other Settings page is; and a settings repository the Omni app cannot read
// (not installed there, or the repository not readable) is named, never shown as "No settings
// repository yet", which is for a workspace naming none.

const ACME: SettingsWorkspace = { id: 'w-acme', githubOrg: 'acme', installation: 77, planRepo: 'plan' };
const KIT: SettingsFile[] = [{ form: 'review', text: 'kit review' }];
const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/&#x27;/g, '\'').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();

/** The pages of a workspace whose settings repository the Omni app cannot read: installed there or
 * not (null), the repository's default branch is never read. */
function pagesOf(installation: number | null) {
  const github: SettingsGithub = {
    installationFor: () => Promise.resolve(installation),
    head: () => Promise.resolve(null),
    file: () => Promise.resolve(null),
  };
  return omniSettingsPagesService({ workspaceById: () => Promise.resolve(ACME), isOwner: () => Promise.resolve(true) }, github, () => KIT).pages('w-acme');
}

async function screenOf(installation: number | null): Promise<string> {
  const view = await pagesOf(installation);
  if (!view) throw new Error('the workspace reads');
  return text(renderToStaticMarkup(createElement(PlaybookScreen, { view: { kind: 'playbook', ...view } })));
}

describe('reaching Settings › Playbook (issue 2538)', () => {
  it('is a Settings tab, after Jev, on every Settings page', () => {
    expect(SETTINGS_TABS.at(-1)).toEqual({ href: PLAYBOOK_PATH, label: 'Playbook' });
  });

  it('is one of the menu\'s Settings pages, after Jev', () => {
    expect(SETTINGS.pages?.at(-1)).toEqual({ label: 'Playbook', path: PLAYBOOK_PATH });
  });
});

describe('a settings repository the Omni app cannot read (issue 2538)', () => {
  it('is named, and says the Omni app cannot read it, not that the workspace has none', async () => {
    const view = await pagesOf(77);
    expect(view).toEqual({ repository: 'acme/plan', commit: null, reason: 'The Omni app cannot read acme/plan.', pages: [] });
    const shown = await screenOf(77);
    expect(shown).toContain('The Omni app cannot read acme/plan.');
    expect(shown).not.toContain('No settings repository yet');
  });

  it('is named, and says the Omni app is not installed there, not that the workspace has none', async () => {
    const shown = await screenOf(null);
    expect(shown).toContain('The Omni app is not installed where acme/plan lives.');
    expect(shown).not.toContain('No settings repository yet');
  });
});
