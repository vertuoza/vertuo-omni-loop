// Bug 2748: gte-small could not embed 64 texts of 2,000 characters within an Edge Function's CPU budget, so every
// call answered 546. The function takes a small batch, and every caller sends no more than it takes.
import { describe, expect, it } from 'vitest';
import { EMBED_BATCH as APP_BATCH } from '../../../apps/omni-app/src/knowledge-embed/embedder.ts';
import { EMBED_BATCH as MCP_BATCH } from '../../../apps/galaxy/src/product-mcp/embed/client.ts';
import { MAX_TEXTS } from './handler.ts';

describe('the embed function\'s batch (bug 2748)', () => {
  it('takes at most 8 texts a call', () => {
    expect(MAX_TEXTS).toBeLessThanOrEqual(8);
  });

  it('is never sent more than it takes, by the App\'s job or by the MCP\'s search', () => {
    expect(APP_BATCH).toBeLessThanOrEqual(MAX_TEXTS);
    expect(MCP_BATCH).toBeLessThanOrEqual(MAX_TEXTS);
  });
});
