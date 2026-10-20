import 'server-only';
import { RosterRow } from '../../business/constituents-rows';
import { parseRows } from '../../data/parse-rows';

// The members' GitHub logins, read as the signed-in person (PRD 2240 s4), so a row can say who created
// it. A roster that cannot be read leaves every author as "a member": never a page that does not open.

/** The slice of a Supabase client the roster read needs. */
type RosterDb = { rpc(fn: 'workspace_roster', args: { workspace: string }): PromiseLike<{ data: unknown; error: { message: string } | null }> };

/** The GitHub login of each member that has one, by account id. */
const loginMap = (roster: readonly { user_id: string; github_login: string | null }[]): Record<string, string> =>
  Object.fromEntries(roster.flatMap((r) => (r.github_login === null ? [] : [[r.user_id, r.github_login] as const])));

/** Each member's GitHub login by account id; a member with none is left out. */
export async function loginsOf(db: RosterDb, workspace: string): Promise<Record<string, string>> {
  try {
    const { data, error } = await db.rpc('workspace_roster', { workspace });
    if (error) throw new Error(error.message);
    const roster = parseRows(RosterRow, data, 'product-knowledge/authors: workspace_roster');
    return roster.ok ? loginMap(roster.value) : {};
  } catch (err) {
    console.error(`product-knowledge: could not read the members (${String(err)})`);
    return {};
  }
}
