import type { AgentToken } from './model';
import { agentTokenStore } from './store';

// Connect an agent's read for Settings › Business (PRD 855 s1): the workspace's links, as the signed-in
// person. One the page can do without: unreadable (or a database from before PRD 855), it reads as
// none, logged, so the business still opens.

type Rpc = Parameters<typeof agentTokenStore>[0];

export async function loadTokens(db: Rpc, workspace: string): Promise<AgentToken[]> {
  try {
    return await agentTokenStore(db).list(workspace);
  } catch (err) {
    console.error(`agent-tokens: could not read the links (${err instanceof Error ? err.message : String(err)})`);
    return [];
  }
}
