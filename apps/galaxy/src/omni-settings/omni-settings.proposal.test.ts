import { parsePr } from 'omni-loop/kit/lib/ids.ts';
import { describe, expect, it } from 'vitest';
import type { SettingsWorkspace } from './omni-settings.repository';
import {
  committedText, omniSettingsEditService, playbookChange,
  type PlaybookChange, type ProposeOutcome, type SettingsPullRequests,
} from './omni-settings.service';

// A workspace owner's change to a playbook page (PRD 2417, s7), with a fake GitHub behind the real
// service: an owner's text opens one pull request in the settings repository, on a branch of its own,
// with the page's file; a member who is not an owner is refused before anything is read; a text the
// next sync would skip, a workspace with no settings repository, the App not installed or unable to
// reach it, and a page that already reads so open nothing. Nothing is stored anywhere but GitHub.

const NOW = Date.parse('2026-10-23T12:34:56Z');
const ACME: SettingsWorkspace = { id: 'w-acme', githubOrg: 'acme', installation: 77, planRepo: 'plan' };
/** A page of `form` as the forms' parser reads one. */
const page = (form: string, body: string) =>
  `---\nform: ${form}\nform-version: 1\nstate: filled\npoints-to: null\nevidence: []\ninvaded: null\nowner: null\n---\n\n${body}`;
const REVIEW = page('review', '# Review\n\n## Fix\nFix a comment that is right and cheap to act on.\n');
const OPENED: ProposeOutcome = { kind: 'opened', pullRequest: { number: parsePr(42), url: 'https://github.com/acme/plan/pull/42' } };

type World = { workspace?: SettingsWorkspace | null; owner?: boolean; installation?: number | null; outcome?: ProposeOutcome };

function service({ workspace = ACME, owner = true, installation = 77, outcome = OPENED }: World = {}) {
  const asked: string[] = [];
  const proposed: { installation: number; repository: string; change: PlaybookChange }[] = [];
  const store = {
    workspaceById: (id: string) => { asked.push(`workspace ${id}`); return Promise.resolve(workspace); },
    isOwner: (id: string) => { asked.push(`owner ${id}`); return Promise.resolve(owner); },
  };
  const github: SettingsPullRequests = {
    installationFor: () => { asked.push('installation'); return Promise.resolve(installation); },
    propose: (at, repository, change) => { proposed.push({ installation: at, repository, change }); return Promise.resolve(outcome); },
  };
  return { edit: omniSettingsEditService(store, github, () => NOW), asked, proposed };
}

const propose = (world: World, edit: Partial<{ workspace: string; form: string; text: string }> = {}) => {
  const built = service(world);
  return { ...built, answer: built.edit.propose({ workspace: 'w-acme', form: 'review', text: REVIEW, ...edit }, 'ada') };
};

describe('proposing a playbook page', () => {
  it('opens one pull request in the settings repository, on a branch of its own, with the page\'s file', async () => {
    const { answer, proposed } = propose({});
    expect(await answer).toEqual({ ok: true, repository: 'acme/plan', pullRequest: { number: 42, url: 'https://github.com/acme/plan/pull/42' } });
    expect(proposed).toHaveLength(1);
    expect(proposed[0]).toMatchObject({ installation: 77, repository: 'acme/plan' });
    expect(proposed[0]?.change).toMatchObject({ path: '.omni-loop/settings/playbook/review.md', text: REVIEW, branch: 'omni-settings/review-20261023-123456' });
  });

  it('writes the decisions page beside the decision records', async () => {
    const { answer, proposed } = propose({}, { form: 'decisions', text: page('decisions', '# Decisions\n') });
    expect((await answer).ok).toBe(true);
    expect(proposed[0]?.change.path).toBe('.omni-loop/settings/adr/README.md');
  });

  it('refuses a member who is not an owner, and a workspace the caller does not read, before anything else', async () => {
    const member = propose({ owner: false });
    expect(await member.answer).toEqual({ ok: false, kind: 'not-owner' });
    expect(member.asked).toEqual(['workspace w-acme', 'owner w-acme']);
    expect(member.proposed).toEqual([]);
    const stranger = propose({ workspace: null }, { text: 'not even a page' });
    expect(await stranger.answer).toEqual({ ok: false, kind: 'not-owner' });
    expect(stranger.asked).toEqual(['workspace w-acme']);
  });

  it('refuses a text the next sync would skip, with its reason, and opens nothing', async () => {
    const noFrontMatter = propose({}, { text: '# Review\n' });
    expect(await noFrontMatter.answer).toMatchObject({ ok: false, kind: 'not-a-page' });
    const otherForm = propose({}, { text: page('testing', '# Testing\n') });
    expect(await otherForm.answer).toEqual({ ok: false, kind: 'not-a-page', reason: 'its front matter says form: testing' });
    const unknown = propose({}, { form: 'nonsense', text: page('nonsense', '# Nonsense\n') });
    expect(await unknown.answer).toEqual({ ok: false, kind: 'not-a-page', reason: 'nonsense is not a form the kit reads' });
    expect([...noFrontMatter.proposed, ...otherForm.proposed, ...unknown.proposed]).toEqual([]);
  });

  it('says so when the workspace has no settings repository, or the App is not installed there', async () => {
    expect(await propose({ workspace: { ...ACME, planRepo: null } }).answer).toEqual({ ok: false, kind: 'no-settings-repository' });
    expect(await propose({ installation: null }).answer).toEqual({ ok: false, kind: 'not-installed', repository: 'acme/plan' });
  });

  it('says so when the page already reads so, or the App cannot reach the repository', async () => {
    expect(await propose({ outcome: { kind: 'unchanged' } }).answer).toEqual({ ok: false, kind: 'unchanged', repository: 'acme/plan' });
    expect(await propose({ outcome: { kind: 'unreachable' } }).answer).toEqual({ ok: false, kind: 'unreachable', repository: 'acme/plan' });
  });

  it('commits the text with plain line ends and one at the end', async () => {
    const { answer, proposed } = propose({}, { text: REVIEW.replace(/\n/g, '\r\n').concat('\r\n\r\n') });
    await answer;
    expect(proposed[0]?.change.text).toBe(REVIEW);
    expect(committedText('a\r\nb')).toBe('a\nb\n');
    expect(committedText('a\rb\n\n\n')).toBe('a\nb\n');
  });
});

describe('playbookChange', () => {
  it('names who proposed it, and says the text lives only in the pull request until a person merges it', () => {
    const change = playbookChange('review', '.omni-loop/settings/playbook/review.md', REVIEW, 'ada', NOW);
    expect(change.message).toBe('docs(settings): the review page, proposed on the Omni page by @ada');
    expect(change.title).toBe('Playbook: a new review page, from the Omni page');
    expect(change.body).toContain('@ada proposed this change to the `review` page');
    expect(change.body).toContain('Once a person merges it, every repository of the workspace reads the new text on its next `omni sync`.');
  });
});
