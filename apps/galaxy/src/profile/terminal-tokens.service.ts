import { messageOf } from 'vertuo-omni-plan/kit/lib/narrow.ts';
import { UNREADABLE, type Read } from '../dashboard/part';
import type { KitTokensMine } from './terminal-tokens.contract';
import type { TerminalTokensRepository } from './terminal-tokens.repository';
import { newestFirst } from './terminal-tokens';

// Terminal tokens on your own profile, its rule (PRD 1628 s4; ADR-0095): your live kit tokens in the
// workspace the profile reads, newest first, with your live count against the limit; unreadable (a
// database from before PRD 1628 among the reasons) when they cannot be read, logged, so the profile
// still opens and says "could not load" in place of the list.

/** Your kit tokens in `workspace`, newest first, or unreadable. */
export async function readTerminalTokens(repository: TerminalTokensRepository, workspace: string): Promise<Read<KitTokensMine>> {
  try {
    const mine = await repository.mine(workspace);
    return { ...mine, tokens: newestFirst(mine.tokens) };
  } catch (error) {
    console.error(`profile: your terminal tokens could not be read (${messageOf(error)})`);
    return UNREADABLE;
  }
}
