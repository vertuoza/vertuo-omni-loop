// Installation tokens kept in server memory (PRD 587): a token is minted once per installation and
// reused until a minute before it expires. What keeps them never lets one leave the module that asks.
import type { InstallationToken } from './github-app';

const TOKEN_MARGIN_MS = 60_000;

/** A token for installation `id`: the kept one while it has more than a minute left, else a new one. */
export function keptInstallationTokens(
  mint: (id: number) => Promise<InstallationToken>, clock: () => number,
): (id: number) => Promise<string> {
  const kept = new Map<number, InstallationToken>();
  return async (id) => {
    const held = kept.get(id);
    if (held !== undefined && held.expiresAt - TOKEN_MARGIN_MS > clock()) return held.token;
    const minted = await mint(id);
    kept.set(id, minted);
    return minted.token;
  };
}
