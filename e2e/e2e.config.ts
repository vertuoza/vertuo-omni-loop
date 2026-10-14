import type { E2EConfig } from 'e2e';
import { web } from '@e2e-dev/web';
import { openrouter } from '@openrouter/ai-sdk-provider';

export default {
  agents: { default: { model: openrouter('anthropic/claude-sonnet-5.5') } },
  targets: [{ engine: web(), app: { url: 'https://vertuo-omni-loop-galaxy.vercel.app' } }],
  cache: { mode: 'read-write', dir: '.e2e/cache' },
} satisfies E2EConfig;
