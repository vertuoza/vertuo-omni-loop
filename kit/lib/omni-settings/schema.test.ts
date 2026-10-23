// PRD 2417, s1: what a settings repository serves through the Omni page, as the route answers it and
// `omni sync` reads it.
import { describe, expect, it } from 'vitest';
import { SettingsFileSchema, SettingsPlaybookSchema, SettingsSourceSchema } from './schema.ts';
import type { SettingsPlaybook } from './schema.ts';

const READ: SettingsPlaybook = {
  repository: 'acme/settings',
  commit: 'a1b2c3d',
  files: [{ form: 'review', text: '---\nform: review\n---\n' }],
  reason: null,
};

/** The first issue's path and message, for a reply the schema refuses. */
function refusal(reply: unknown): string {
  const parsed = SettingsPlaybookSchema.safeParse(reply);
  const issue = parsed.success ? undefined : parsed.error.issues[0];
  return issue ? `${issue.path.join('.')}: ${issue.message}` : 'accepted';
}

describe('SettingsPlaybookSchema — the tech playbook a settings repository serves', () => {
  it('reads the settings repository, the commit read and its files', () => {
    expect(SettingsPlaybookSchema.parse(READ)).toEqual(READ);
  });

  it('reads an empty list with its reason: no settings repository, or one holding no file', () => {
    const none = { repository: null, commit: null, files: [], reason: 'the workspace names no settings repository' };
    expect(SettingsPlaybookSchema.parse(none)).toEqual(none);
    const empty = { ...READ, files: [], reason: 'acme/settings holds no file under .omni-loop/settings/' };
    expect(SettingsPlaybookSchema.parse(empty)).toEqual(empty);
  });

  it.each([
    ['an empty list that says not why', { ...READ, files: [] }, 'reason: an empty list says why'],
    ['a reason beside files read', { ...READ, reason: 'why' }, 'reason: only an empty list carries a reason'],
    ['a commit with no repository', { ...READ, repository: null }, 'commit: a commit is read from a settings repository: both are set, or neither'],
    ['files with no repository', { repository: null, commit: null, files: READ.files, reason: null }, 'files: no settings repository holds no file'],
    ['a repository that is no owner/name', { ...READ, repository: 'settings' }, 'repository: owner/name'],
    ['a commit that is no commit', { ...READ, commit: 'main' }, 'commit: a git commit'],
    ['a key it does not know', { ...READ, branch: 'main' }, ''],
  ])('refuses %s', (_case, reply, message) => {
    expect(refusal(reply)).not.toBe('accepted');
    expect(refusal(reply)).toContain(message);
  });
});

describe('SettingsFileSchema — one file', () => {
  it('names its form as a file name, never a path', () => {
    expect(SettingsFileSchema.safeParse({ form: 'definition-of-done', text: '' }).success).toBe(true);
    for (const form of ['../briefing', 'playbook/review', 'Review', '', 'review.md', 'review-']) {
      expect(SettingsFileSchema.safeParse({ form, text: '' }).success, form).toBe(false);
    }
  });
});

describe('SettingsSourceSchema — where a set of files came from', () => {
  it('reads a repository, a commit and a time, and refuses anything else', () => {
    const source = { repository: 'acme/settings', commit: 'a1b2c3d', readAt: '2026-10-23T08:00:00.000Z' };
    expect(SettingsSourceSchema.parse(source)).toEqual(source);
    expect(SettingsSourceSchema.safeParse({ ...source, readAt: 'yesterday' }).success).toBe(false);
    expect(SettingsSourceSchema.safeParse({ ...source, extra: 1 }).success).toBe(false);
  });
});
