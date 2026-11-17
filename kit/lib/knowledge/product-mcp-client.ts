// The kit's reader of a product's knowledge (PRD 3007, s2): `omni kb search` and `omni kb get` call the
// product's MCP route, `POST <ask.url>/api/products/<key>/mcp` (PRD 2707), with the current sign-in.
//
// - The sign-in is the kit's own: the one `omni signin` keeps, or the access token `OMNI_TOKEN` is traded for
//   (`../ask/client.ts`, which renews it). A 401 renews it once and sends the call again.
// - The product is the one this checkout remembers (`omni product use`), else the one `omni product which`
//   gives, its name read as a key (lowercase, kebab-case).
// - Each failure is one line, never a wait past the call timeout: no sign-in, knowledge off, no product, the Omni
//   page unreachable (BL-GATE-1: a call that cannot answer never reads as an empty list).
// - Nothing is written: no key, no token, no file (L-GDPR-2).
import { z } from 'zod';
import { AskCallError, askClient, CALL_TIMEOUT_MS } from '../ask/client.ts';
import type { Fetch, TokenStore } from '../ask/client.ts';
import { homeTokens } from '../ask/client-tokens.ts';
import { credentialsHost } from '../ask/credentials.ts';
import { ProductsWhichSchema } from '../product/import.ts';

export const NOT_SIGNED_IN = 'Not signed in to the Omni page: run omni signin.';
export const KNOWLEDGE_OFF = "This product's knowledge is off: a workspace owner turns it on in Product settings.";
export const NO_PRODUCT = 'This repository is in no product: its knowledge is in omni kb show.';
export const UNREACHABLE = 'The Omni page is unreachable: carry on with omni kb show.';

/** What a call answers: the tool's text, or the one line saying why there is none. */
export type KnowledgeReply = { ok: true; text: string } | { ok: false; line: string };

/** The two tools, with the inputs the server reads. */
export type KnowledgeCall =
  | { tool: 'search_knowledge'; args: { query?: string; kind?: string; domain?: string; repo?: string } }
  | { tool: 'get_knowledge'; args: { id: string } };

const refuse = (line: string): KnowledgeReply => ({ ok: false, line });

/** A product's name as the key the route takes: lowercase, kebab-case; null when nothing of it is left. */
export function keyOfName(name: string): string | null {
  const key = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return /^[a-z]/.test(key) ? key.slice(0, 40).replace(/-+$/, '') : null;
}

/** One line from a failed call's `AskCallError`. */
function lineOf(error: unknown): string {
  if (!(error instanceof AskCallError) || error.status === null) return UNREACHABLE;
  if (error.status === 401 || error.status === 403) return error.message.startsWith('OMNI_TOKEN') ? error.message.split('\n')[0] ?? NOT_SIGNED_IN : NOT_SIGNED_IN;
  return UNREACHABLE;
}

const RpcSchema = z.object({
  result: z.object({
    content: z.array(z.object({ type: z.string(), text: z.string().optional() })).default([]),
    isError: z.boolean().optional(),
  }).optional(),
  error: z.object({ message: z.string() }).optional(),
});

/** The JSON-RPC answer in `body`: plain JSON, or the last `data:` event of a stream. */
function rpcOf(body: string): unknown {
  try {
    return JSON.parse(body);
  } catch {
    const data = body.split('\n').filter((line) => line.startsWith('data:')).at(-1);
    return data === undefined ? null : (JSON.parse(data.slice(5)) as unknown);
  }
}

/** The tool answer in a reply, as text; a tool error is its text on one line. */
function replyOf(body: string): KnowledgeReply {
  let parsed: z.infer<typeof RpcSchema> | null = null;
  try {
    const checked = RpcSchema.safeParse(rpcOf(body));
    parsed = checked.success ? checked.data : null;
  } catch {
    parsed = null;
  }
  if (parsed?.result === undefined) return refuse(UNREACHABLE);
  const text = parsed.result.content.map((part) => part.text ?? '').join('\n');
  return parsed.result.isError === true ? refuse(text.replace(/\s+/g, ' ').trim() || UNREACHABLE) : { ok: true, text };
}

/** What `callKnowledge` is given. */
export type KnowledgeIo = {
  askUrl: string | null;
  /** The repository's `owner/name`. */
  repo: string | null;
  /** The product key the checkout remembers, or null. */
  remembered: string | null;
  tokens?: TokenStore | undefined;
  home?: string | undefined;
  fetch?: Fetch | undefined;
  callMs?: number | undefined;
};

/** The one call `call` names, to the product's MCP route, signed in as the kit is. */
export async function callKnowledge(io: KnowledgeIo, call: KnowledgeCall): Promise<KnowledgeReply> {
  const { askUrl, repo } = io;
  if (!askUrl) return refuse(NOT_SIGNED_IN);
  const host = credentialsHost(askUrl);
  const store = io.tokens ?? homeTokens({ home: io.home });
  if (!store.read(host)) return refuse(NOT_SIGNED_IN);
  const fetch = io.fetch ?? globalThis.fetch;
  const callMs = io.callMs ?? CALL_TIMEOUT_MS;
  const client = askClient({ baseUrl: askUrl, host, tokens: store, fetch, callMs });

  const key = io.remembered ?? (await productKey(repo, client));
  if (typeof key !== 'string') return key;

  const url = `${askUrl.replace(/\/+$/, '')}/api/products/${encodeURIComponent(key)}/mcp`;
  const body = JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: call.tool, arguments: call.args } });
  const post = async (): Promise<Response> => {
    try {
      return await fetch(url, {
        method: 'POST',
        headers: { accept: 'application/json, text/event-stream', 'content-type': 'application/json', authorization: `Bearer ${store.read(host)?.access_token ?? ''}` },
        body,
        signal: AbortSignal.timeout(callMs),
      });
    } catch {
      throw new AskCallError('POST mcp: unreachable');
    }
  };
  return exchange(post, client, () => store.read(host)?.access_token ?? '');
}

/** `post` answered, the sign-in renewed once on a 401 (a kit token's empty access token is traded first). */
async function exchange(post: () => Promise<Response>, client: ReturnType<typeof askClient>, token: () => string): Promise<KnowledgeReply> {
  try {
    if (token() === '' && (await client.renew()) !== 'renewed') return refuse(NOT_SIGNED_IN);
    let response = await post();
    if (response.status === 401) {
      const renewed = await client.renew();
      if (renewed !== 'renewed') return refuse(renewed === 'refused' ? NOT_SIGNED_IN : UNREACHABLE);
      response = await post();
    }
    return await answerOf(response);
  } catch (error) {
    return refuse(lineOf(error));
  }
}

/** The reply a response is: the refusal its status is, or the tool's answer. */
async function answerOf(response: Response): Promise<KnowledgeReply> {
  if (response.status === 401) return refuse(NOT_SIGNED_IN);
  if (response.status === 404) return refuse(KNOWLEDGE_OFF);
  return response.ok ? replyOf(await response.text()) : refuse(UNREACHABLE);
}

/** The key of the product `repo` is in, as `omni product which` says it, or the line saying why there is none. */
async function productKey(repo: string | null, client: ReturnType<typeof askClient>): Promise<string | KnowledgeReply> {
  if (!repo) return refuse(NO_PRODUCT);
  try {
    const which = ProductsWhichSchema.safeParse(await client.readProductsOf(repo));
    return (which.success ? keyOfName(which.data.products[0]?.name ?? '') : null) ?? refuse(NO_PRODUCT);
  } catch (error) {
    return refuse(lineOf(error));
  }
}

const SearchAnswerSchema = z.object({
  hits: z.array(z.object({ id: z.string(), kind: z.string(), title: z.string(), repo: z.string().nullable(), snippet: z.string().optional() })),
  total: z.number().optional(),
  repositories: z.array(z.object({ repo: z.string(), pack: z.unknown().nullable(), note: z.string().optional() })).default([]),
});

const GetAnswerSchema = z.object({
  entry: z.object({
    id: z.string(), kind: z.string(), title: z.string(), repo: z.string().nullable(), domain: z.string().nullable().optional(),
    body: z.string(), file: z.string().nullable().optional(), status: z.string().nullable().optional(),
  }),
});

/** `text` as JSON, or null when it is none. */
function jsonOf(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

const oneLine = (text: string): string => text.replace(/\s+/g, ' ').trim();

/** The notes of repositories with no knowledge pack yet, one line each. */
const notesOf = (repositories: z.infer<typeof SearchAnswerSchema>['repositories']): string[] =>
  repositories.flatMap(({ repo, pack, note }) => (pack === null && note !== undefined ? [`${repo}: ${oneLine(note)}`] : []));

/** A search answer as lines, the best hit first: id, kind and repository, the title, then its snippet. */
export function searchLines(text: string): string[] {
  const parsed = SearchAnswerSchema.safeParse(jsonOf(text));
  if (!parsed.success) return [UNREACHABLE];
  const { hits, total, repositories } = parsed.data;
  const lines = hits.length === 0
    ? ['No hit: the product\'s knowledge holds no answer to this search.']
    : hits.flatMap((hit) => [
      `${hit.id} · ${hit.kind} · ${hit.repo ?? 'the product'} — ${oneLine(hit.title)}`,
      ...(hit.snippet ? [`  ${oneLine(hit.snippet)}`] : []),
    ]);
  if (total !== undefined && total > hits.length) lines.push(`${hits.length} of ${total} hits shown: narrow the search with --kind, --domain or --repo.`);
  return [...lines, ...notesOf(repositories)];
}

/** One entry whole, as lines: its id, kind, repository and title, then its body. */
export function entryLines(text: string): string[] {
  const parsed = GetAnswerSchema.safeParse(jsonOf(text));
  if (!parsed.success) return [UNREACHABLE];
  const { entry } = parsed.data;
  const where = [entry.repo ?? 'the product', ...(entry.domain ? [`domain ${entry.domain}`] : []), ...(entry.status ? [entry.status] : [])];
  return [`${entry.id} · ${entry.kind} · ${where.join(' · ')} — ${oneLine(entry.title)}`, '', entry.body];
}
