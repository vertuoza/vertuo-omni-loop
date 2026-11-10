import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '../../../../../supabase/database.types.ts';
import type { WriteSource } from '../constituents/knowledge-reader';
import { setMcp } from './mcp-server.repository';

// The MCP server card's write in the browser (PRD 2707 s4): product_mcp_set() called as the signed-in person,
// with the publishable key only; in the demo, nothing is written and the card only moves.

/** Turns the server on or off; whether it was accepted. */
export const switchServer = (source: WriteSource, product: string, on: boolean): Promise<boolean> =>
  source.kind === 'demo' ? Promise.resolve(true) : setMcp(createBrowserClient<Database>(source.url, source.key), product, on);
