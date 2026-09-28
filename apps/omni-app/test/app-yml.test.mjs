import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import { HANDLED } from '../src/webhook/webhook.mjs';

// The GitHub App manifest the org admin registers the app from (PRD 28, "The app's manifest").
// Least privilege (decision 9): exactly these permissions and events, nothing more. PRD 72 widens
// the permissions once, for the retro (its decision 11): `contents: write`, `issues: write` and
// `actions: read`; the events stay the same. PRD 359 makes the app public, so anyone can install it
// and a workspace is born from the installation (its decision 4): `public: true` and a `setup_url`
// at galaxy's `/signup/installed`, permissions and events unchanged.
const manifest = parse(readFileSync(fileURLToPath(new URL('../app.yml', import.meta.url)), 'utf8'));

describe('app.yml — the GitHub App manifest', () => {
  it('names the app omni-loop and makes it public: anyone can install it', () => {
    expect(manifest.name).toBe('omni-loop');
    expect(manifest.public).toBe(true);
  });

  it('sends an installer to galaxy’s /signup/installed, over https', () => {
    const setup = new URL(manifest.setup_url);
    expect(setup.protocol).toBe('https:');
    expect(setup.pathname).toBe('/signup/installed');
    expect(setup.search).toBe('');
  });

  it('asks for exactly the spec’s permissions: the outbox check’s, widened once for the retro', () => {
    expect(manifest.default_permissions).toEqual({
      checks: 'write',
      contents: 'write',
      pull_requests: 'write',
      metadata: 'read',
      issues: 'write',
      actions: 'read',
    });
  });

  it('subscribes to exactly the spec’s events', () => {
    expect([...manifest.default_events].sort()).toEqual(['check_run', 'pull_request']);
  });

  it('subscribes to exactly the events the webhook handles', () => {
    expect([...manifest.default_events].sort()).toEqual(Object.keys(HANDLED).sort());
  });

  it('the webhook handles exactly the spec’s actions, `closed` included for the retro', () => {
    expect(HANDLED).toEqual({
      pull_request: ['opened', 'synchronize', 'reopened', 'ready_for_review', 'labeled', 'unlabeled', 'edited', 'closed'],
      check_run: ['rerequested'],
    });
  });

  it('delivers its webhooks to /api/github, active', () => {
    expect(manifest.hook_attributes.active).toBe(true);
    expect(new URL(manifest.hook_attributes.url).pathname).toBe('/api/github');
  });

  it('carries no key beyond the manifest’s own', () => {
    const allowed = [
      'name',
      'url',
      'description',
      'hook_attributes',
      'redirect_url',
      'callback_urls',
      'setup_url',
      'public',
      'default_permissions',
      'default_events',
      'request_oauth_on_install',
      'setup_on_update',
    ];
    expect(Object.keys(manifest).filter((key) => !allowed.includes(key))).toEqual([]);
  });
});
