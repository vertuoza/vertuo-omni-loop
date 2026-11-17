// `omni mcp` (PRD 3007, s3): the kit's MCP server for the product's knowledge, over stdio (the server itself is
// `../../lib/knowledge/mcp-server.ts`). The omni plugin declares it as `omni-knowledge`, so every session with the
// plugin, and every runner job, has `search_knowledge` and `get_knowledge`, signed in as the kit is.
//
// It runs before a context exists, like `product`, and loads the context itself at each call, never before the
// first: a session that never searches makes no request, and a repository with no kit answers the "no product" line.
// The repository's own `omni` is the one that runs, from the session's directory. A test hands it `stdin` (a text
// or a stream), `tokens`, `home`, `fetch` and `callMs`.
import type { Fetch, TokenStore } from '../../lib/ask/client.ts';
import { homeTokens } from '../../lib/ask/client-tokens.ts';
import type { HookStdin } from '../../lib/ask/hook-input.ts';
import { loadContext } from '../../lib/context.ts';
import { mainCheckout } from '../../lib/dossier/local.ts';
import { serveKnowledgeMcp } from '../../lib/knowledge/mcp-server.ts';
import { callKnowledge, NO_PRODUCT } from '../../lib/knowledge/product-mcp-client.ts';
import type { KnowledgeCall, KnowledgeReply } from '../../lib/knowledge/product-mcp-client.ts';
import { rememberedProduct } from '../../lib/product/checkout.ts';
import { parseArgs, usageError } from '../args.ts';
import type { FreeCommand, FreeIo } from '../io.ts';

/** What a test hands `omni mcp` beyond `main()`'s own. */
type McpOptions = {
  stdin?: HookStdin;
  tokens?: TokenStore | undefined;
  home?: string | undefined;
  fetch?: Fetch | undefined;
  callMs?: number | undefined;
};

/** The input as a stream of chunks: a text is one chunk, none (or a terminal) is nothing. */
async function* chunksOf(stdin: HookStdin): AsyncGenerator<string | Uint8Array> {
  if (typeof stdin === 'string') {
    yield stdin;
    return;
  }
  if (!stdin) return;
  yield* stdin;
}

export const mcp: FreeCommand = {
  withoutContext: true,
  async run(args: string[], io: FreeIo & McpOptions): Promise<number> {
    const { positional } = parseArgs('mcp', args);
    if (positional.length > 0) throw usageError('usage: omni mcp');
    const stdin = io.stdin === undefined ? process.stdin : io.stdin;
    // One store for the whole session: a kit token's access token, once traded, is kept in it, in memory only.
    const tokens = io.tokens ?? homeTokens({ home: io.home, omniToken: io.vars.omniToken?.token ?? null });
    const call = async (asked: KnowledgeCall): Promise<KnowledgeReply> => {
      let ctx;
      try {
        ctx = loadContext(io.cwd, { exec: io.exec });
      } catch {
        return { ok: false, line: NO_PRODUCT };
      }
      return callKnowledge({
        askUrl: ctx.config.ask.url,
        repo: ctx.config.repo.slug,
        remembered: rememberedProduct(mainCheckout(io.cwd, io.exec) ?? ctx.root)?.key ?? null,
        tokens,
        home: io.home,
        fetch: io.fetch,
        callMs: io.callMs,
      }, asked);
    };
    await serveKnowledgeMcp({ input: chunksOf(stdin), write: (line) => io.stdout.write(line), call });
    return 0;
  },
};
