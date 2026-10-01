import { z } from 'zod';
import { unknownWorthAsking, type UnknownInput } from '../../jev/decisions/unknown-worth-asking';
import { decide, type JevDecideDeps } from '../../jev/resolve';

// Jev's Unknown worth asking after a report (PRD 855 s4, decision 13): once report_unknown has answered,
// Jev reads the new question, its repository and file and the product's confirmed claims, and says whether
// a person should be asked. Today's answer is always yes. The resolver (../../jev/resolve.ts) applies the
// decision's mode: Off never calls Jev; Shadow logs Jev's answer and the question stays open; On counts a
// "no" at or above the confidence floor, and the question is set aside (folded under "Jev set aside N" on
// Settings › Business, out of the bell, with Bring back). Never throws: a failure leaves the question open.
//
// The database: agent_question_for_jev() and agent_question_set_aside()
// (supabase/migrations/20261028110000_unknown_worth_asking.sql), the service role's only, as every Jev
// decision reads its settings and key.

type Rpc = { rpc(fn: string, args: Record<string, unknown>): PromiseLike<{ data: unknown; error: unknown }> };

export interface JudgeDeps {
  /** What Jev reads of an open question, and its workspace; null when it is gone or no longer open. */
  context(question: string): Promise<{ workspace: string; input: UnknownInput } | null>;
  setAside(question: string): Promise<void>;
  jev: JevDecideDeps;
}

const CONTEXT = z.object({
  workspace: z.string().min(1),
  question: z.string().min(1),
  state: z.string(),
  repo: z.string().nullable(),
  file: z.string().nullable(),
  claims: z.array(z.string()),
});

const why = (err: unknown) => (err instanceof Error ? err.message : String((err as { message?: unknown })?.message ?? err));

/** The judge's dependencies on a database client acting as the service role. */
export function questionJudge(db: Rpc, jev: JevDecideDeps): JudgeDeps {
  const call = async (fn: string, question: string) => {
    const { data, error } = await db.rpc(fn, { p_question: question });
    if (error) throw new Error(`${fn}: ${why(error)}`);
    return data;
  };
  return {
    async context(question) {
      const read = CONTEXT.safeParse(await call('agent_question_for_jev', question));
      if (!read.success || read.data.state !== 'open') return null;
      const { workspace, question: text, repo, file, claims } = read.data;
      return { workspace, input: { question: text, repo, file, claims } };
    },
    async setAside(question) {
      await call('agent_question_set_aside', question);
    },
    jev,
  };
}

/** Runs Unknown worth asking on a question just reported: `set-aside` when Jev's "no" counted. */
export async function judgeQuestion(deps: JudgeDeps, question: string): Promise<'set-aside' | 'kept'> {
  try {
    const found = await deps.context(question);
    if (!found) return 'kept';
    const counted = await decide(deps.jev, {
      workspace: found.workspace, entry: unknownWorthAsking, input: found.input, old: async () => true, ref: `agent question ${question}`,
    });
    if (counted.decidedBy !== 'jev' || counted.value !== false) return 'kept';
    await deps.setAside(question);
    return 'set-aside';
  } catch (err) {
    console.error(`agent-questions: Unknown worth asking left question ${question} open (${why(err)})`);
    return 'kept';
  }
}
