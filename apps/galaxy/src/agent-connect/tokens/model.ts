import { z } from 'zod';

// Connect an agent (PRD 855 s1): what Settings › Business shows of a workspace's links, and the setup a
// person pastes into their editor. A link, as agent_tokens_list() answers it, never carries its hash:
// its name, its last four characters, who made it, when, when an agent last read through it, whether
// it is the viewer's own and whether the viewer may revoke it (its maker, or an owner), and whether it
// still works (its maker is still a member of the workspace).
// PRD 1628 s4: the list also holds members' terminal tokens (`scope: kit`, with the day each expires),
// to their maker and to an owner only, so an owner revokes any member's where every link is listed. A
// database from before PRD 1628 sends neither field: every row is then a link.

export const TOKEN_NAME_MAX = 40;
/** The live links one person may hold (decision 7). */
export const LIVE_MAX = 20;
/** The name the setup gives the MCP server in the editor. */
const SERVER_NAME = 'omni-business';
/** Where an MCP client reaches the business on galaxy. */
const MCP_PATH = '/api/mcp';

const agentTokenSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(TOKEN_NAME_MAX),
  lastFour: z.string().length(4),
  createdAt: z.string(),
  lastUsedAt: z.string().nullable(),
  maker: z.object({ id: z.string(), login: z.string().nullable(), name: z.string().nullable() }),
  mine: z.boolean(),
  canRevoke: z.boolean(),
  working: z.boolean(),
  scope: z.enum(['business', 'kit']).optional(),
  expiresAt: z.string().nullable().optional(),
});

export type AgentToken = z.infer<typeof agentTokenSchema>;

/** A link as the database answered it, or null when it is not one. */
export function tokenOf(value: unknown): AgentToken | null {
  const read = agentTokenSchema.safeParse(value);
  return read.success ? read.data : null;
}

/** The links as the database answered them, or null when the answer is not a list of links. */
export function tokensOf(value: unknown): AgentToken[] | null {
  const read = z.array(agentTokenSchema).safeParse(value);
  return read.success ? read.data : null;
}

/** A link's name as a person typed it: trimmed, 1 to 40 characters on one line, or null. */
export function nameOf(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const name = value.trim();
  return name.length >= 1 && name.length <= TOKEN_NAME_MAX && !/[\r\n\t]/.test(name) ? name : null;
}

/** Who made a link, as the list says it: their name, else their GitHub login, else "someone". */
export const makerLabel = (t: AgentToken) => t.maker.name ?? (t.maker.login ? `@${t.maker.login}` : 'someone');

/** A date as the list says it: `1 Oct 2026`. */
export function dayLabel(iso: string): string {
  const at = new Date(iso);
  return Number.isNaN(at.getTime()) ? iso : at.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

/** When an agent last read through a link. */
export const lastUsedLabel = (t: AgentToken) => (t.lastUsedAt ? `last used ${dayLabel(t.lastUsedAt)}` : 'never used');

/** Whether a listed row is a terminal token (PRD 1628), not a link to the business. */
export const isTerminalToken = (t: AgentToken) => t.scope === 'kit';

/** When a terminal token stops working, as the list says it; null for a link, which never expires. */
export const expiresLabel = (t: AgentToken) => (t.expiresAt ? `expires ${dayLabel(t.expiresAt)}` : null);

export interface Setup {
  /** Which editor or client. */
  label: string;
  /** Where it goes, in plain words. */
  where: string;
  /** The text to paste. */
  text: string;
}

/** The ready-to-paste setup for Cursor, Claude Code and any MCP client, for `token` at galaxy's `url`. */
export function setupsOf(url: string, token: string): Setup[] {
  const header = `Bearer ${token}`;
  return [
    {
      label: 'Cursor',
      where: 'In .cursor/mcp.json',
      text: JSON.stringify({ mcpServers: { [SERVER_NAME]: { url, headers: { Authorization: header } } } }, null, 2),
    },
    {
      label: 'Claude Code',
      where: 'In a terminal, in your repository',
      text: `claude mcp add --transport http ${SERVER_NAME} ${url} --header "Authorization: ${header}"`,
    },
    {
      label: 'Any MCP client',
      where: 'Streamable HTTP',
      text: `URL: ${url}\nHeader: Authorization: ${header}`,
    },
  ];
}

/** Galaxy's MCP address, from the origin a page or a request was served from. */
export const mcpUrlOf = (origin: string) => `${origin.replace(/\/+$/, '')}${MCP_PATH}`;
