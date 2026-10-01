// @ts-nocheck
import { describe, expect, it } from 'vitest';
import { isReleaseSubject, nextVersion } from './next-version.ts';

describe('nextVersion', () => {
  it('starts at 0.0.1 when there is no tag', () => {
    expect(nextVersion([])).toBe('0.0.1');
  });

  it('takes the highest v0.0.<n> tag plus one', () => {
    expect(nextVersion(['v0.0.9'])).toBe('0.0.10');
    expect(nextVersion(['v0.0.2', 'v0.0.11', 'v0.0.9'])).toBe('0.0.12');
  });

  it('ignores tags of any other shape', () => {
    expect(nextVersion(['v1.2', 'release-3', 'v0.1.0', 'v0.0.x', '0.0.5', 'v0.0.4-rc1', 'v0.0.07'])).toBe('0.0.1');
    expect(nextVersion(['v1.2', 'v0.0.3', 'release-3', 'v0.1.0'])).toBe('0.0.4');
  });

  it('ignores blank lines and surrounding spaces', () => {
    expect(nextVersion(['', '  v0.0.7  ', ''])).toBe('0.0.8');
  });
});

describe('isReleaseSubject', () => {
  it('knows a release commit by its subject', () => {
    expect(isReleaseSubject('chore(release): v0.0.4')).toBe(true);
    expect(isReleaseSubject('chore(release): v0.0.4\n')).toBe(true);
  });

  it('refuses anything else', () => {
    expect(isReleaseSubject('feat(kit): omni version (#351)')).toBe(false);
    expect(isReleaseSubject('chore(release): notes')).toBe(false);
    expect(isReleaseSubject('Revert "chore(release): v0.0.4"')).toBe(false);
  });
});
