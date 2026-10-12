// The reader's own votes (PRD 1246, s3): public.idea_votes, written as the signed-in person, so
// row-level security decides: one vote per (idea, account), only their own, on a public board. Each
// write answers the database's refusal, or null. A vote that is already there counts as counted.
type Answer = PromiseLike<{ error: { code?: string; message: string } | null }>;

/** The two writes a vote makes on the Supabase client, whichever side holds the session. */
export type VotesDb = {
  from(table: 'idea_votes'): {
    insert(row: { idea_id: string }): Answer;
    delete(): { eq(column: 'idea_id', value: string): Answer };
  };
};

/** Postgres's unique violation: this account's vote on this idea is already counted. */
const ALREADY = '23505';

export async function addVote(db: VotesDb, ideaId: string): Promise<string | null> {
  const { error } = await db.from('idea_votes').insert({ idea_id: ideaId });
  return error && error.code !== ALREADY ? error.message : null;
}

/** Takes the reader's vote back; row-level security keeps every other account's vote out of reach. */
export async function removeVote(db: VotesDb, ideaId: string): Promise<string | null> {
  const { error } = await db.from('idea_votes').delete().eq('idea_id', ideaId);
  return error ? error.message : null;
}
