import type { E2EConfig } from 'e2e';
import { web } from '@e2e-dev/web';
import { openrouter } from '@openrouter/ai-sdk-provider';

export default {
  // OpenRouter reads OPENROUTER_API_KEY from the shell; the key is never written in this repository.
  agents: {
    default: {
      model: openrouter('anthropic/claude-sonnet-5.5'),
      system: 'You are a thorough QA agent. Verify every outcome.',
    },
  },
  targets: [{
    engine: web(),
    app: {
      // The target of the run: the address e2e.url names (APP_URL overrides it).
      url: process.env.APP_URL ?? 'http://localhost:3100',
    },
  }],
} satisfies E2EConfig;
