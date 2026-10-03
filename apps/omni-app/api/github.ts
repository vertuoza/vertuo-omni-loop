// `/api/github`: where GitHub delivers the app's webhooks (../src/webhook/github-route.ts). The app's
// environment is read when this module loads (../src/env.ts): a half-set group, a malformed value, or
// in production a missing GITHUB_WEBHOOK_SECRET or GitHub App, fails the function's start with one
// error naming every variable concerned, never a value.
import { processEnv, readEnv } from '../src/env.ts';
import { githubRoute } from '../src/webhook/github-route.ts';

export const { POST, GET } = githubRoute(readEnv(processEnv()));
