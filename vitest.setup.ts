import { vi } from 'vitest';

// A runner job that runs as a GitHub App sets the bot as git's author and committer through the
// environment (`githubAppVariables`, PRD 2433). Git prefers those variables to a repository's own
// `user.email`, so every fixture repository's commits would read as the bot's and a test of "your PRDs"
// would find none. Tests build their own identities, so the job's stops here (#2618).
for (const name of ['GIT_AUTHOR_NAME', 'GIT_AUTHOR_EMAIL', 'GIT_COMMITTER_NAME', 'GIT_COMMITTER_EMAIL']) {
  vi.stubEnv(name, undefined);
}
