// The e2e project of this repository (PRD 2898), in `e2e.dir`: the scenarios of a PRD's `e2e`
// acceptance criteria, each one test titled `AC-<n>: …` and tagged `prd-<n>` that /omni:validate-e2e
// writes under tests/, run on one web target. The e2e job of .github/workflows/checks.yml runs them
// on the pull request's preview: it sets APP_URL to the preview, hands the protection bypass and the
// OpenRouter key over from its secrets, and sets E2E_TELEMETRY_DISABLED=1. Run by hand, APP_URL
// falls back to the arcade on this machine.
//
// The goal steps' model is `e2e.model` of .omni-loop/config.yml, reached through OpenRouter, whose
// provider reads OPENROUTER_API_KEY itself: no key is written here. The bypass is the variable
// `e2e.bypassEnv` names, sent only to the app's own origin. The run writes report.json, junit.xml
// and the HTML report (steps, screenshots) under .e2e/, which CI keeps as the run's artifact. No
// video: the spec asked for none.
import { fileURLToPath } from 'node:url';
import { htmlReporter } from '@e2e-dev/html-reporter';
import { web } from '@e2e-dev/web';
import { openrouter } from '@openrouter/ai-sdk-provider';
import type { E2EConfig } from 'e2e';
import { loadConfig } from '../kit/lib/config.ts';
import { processEnv } from '../kit/lib/env/read.ts';

/** Where the arcade runs on this machine (`pnpm galaxy:dev`), when no APP_URL names a preview. */
const LOCAL_APP = 'http://localhost:3000';

const env = processEnv();
const { e2e } = loadConfig(fileURLToPath(new URL('..', import.meta.url)));
const bypass = e2e.bypassEnv === null ? '' : (env[e2e.bypassEnv] ?? '');

export default {
  tests: 'tests/**/*.e2e.ts',
  targets: [
    {
      name: 'web',
      engine: web({ browser: 'chromium', ...(bypass === '' ? {} : { headers: { 'x-vercel-protection-bypass': bypass } }) }),
      // The identity keeps the replay cache's key the same from one preview's address to the next.
      app: { url: env.APP_URL ?? LOCAL_APP, identity: 'galaxy' },
    },
  ],
  agents: { default: { model: openrouter(e2e.model) } },
  reporters: ['list', 'junit', htmlReporter()],
} satisfies E2EConfig;
