import { z } from 'zod';
import { unknownWorthAsking, type UnknownInput } from '../../jev/decisions/unknown-worth-asking';
import { decide, type JevDecideDeps } from '../../jev/resolve';
import { propertyOf } from 'vertuo-omni-plan/kit/lib/narrow.ts';

// Jev's Unknown worth asking after a report (PRD 855 s4, decision 13): once report_unknown has answered,
// Jev reads the new question, its repository and file and the product's confirmed claims, and says whether
// a person should be asked. Today's answer is always yes.
//
// The Jev step runs only when the link's workspace has its Jev key set up (Settings › Jev) and the decision
// is not Off. The workspace comes from the link itself, checked by the database (agent_link_workspace());
// then only Jev's settings and key are read. Without a key, or Off, the step is not run: no Jev call, no
// set-aside, nothing of the question read, and the question stays open for a person.
//
// Once it runs, the resolver (../../jev/resolve.ts) applies the mode: Shadow logs Jev's answer and the
// question stays open; On counts a "no" at or above the confidence floor, and the question is set aside
// (folded under "Jev set aside N" on Settings › Business, out of the bell, with Bring back). Never throws:
// a failure leaves the question open.
//
// The database (supabase/migrations/20261028110000_unknown_worth_asking.sql): agent_link_workspace() as
// the link, through the anon client; agent_question_for_jev() and agent_question_set_aside() the service
// role's only, as every Jev decision reads its settings and key.

type Rpc = { rpc(fn: string, args: Record<string, unknown>): PromiseLike<{ data: unknown; error: unknown }> };

export interface JudgeDeps {
  /** The workspace a live link reports to, checked by the database; null when the database names none. */
  linkWorkspace(link: string): Promise<string | null>;
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

const why = (err: unknown) => (err instanceof Error ? err.message : String(propertyOf(err, 'message') ?? err));

async function call(on: Rpc, fn: string, args: Record<string, unknown>) {
  const { data, error } = await on.rpc(fn, args);
  if (error) throw new Error(`${fn}: ${why(error)}`);
  return data;
}

/** The judge's dependencies: `db` acts as the service role, `linked` as nobody (the link's own calls). */
export function questionJudge(db: Rpc, linked: Rpc, jev: JevDecideDeps): JudgeDeps {
  return {
    async linkWorkspace(link) {
      const workspace = await call(linked, 'agent_link_workspace', { p_hash: link });
      return typeof workspace === 'string' && workspace ? workspace : null;
    },
    async context(question) {
      const read = CONTEXT.safeParse(await call(db, 'agent_question_for_jev', { p_question: question }));
      if (!read.success || read.data.state !== 'open') return null;
      const { workspace, question: text, repo, file, claims } = read.data;
      return { workspace, input: { question: text, repo, file, claims } };
    },
    async setAside(question) {
      await call(db, 'agent_question_set_aside', { p_question: question });
    },
    jev,
  };
}

/** Whether the workspace runs the Jev step at all: the decision is not Off and its Jev key is set up. */
async function jevSetUp(jev: JevDecideDeps, workspace: string): Promise<boolean> {
  const settings = await jev.settings(workspace, unknownWorthAsking.name);
  return settings.mode !== 'off' && (await jev.key(workspace)).kind !== 'none';
}

/** A question just reported through a link (the token's hash). */
interface Reported {
  question: string;
  link: string;
}

/**
 * Runs Unknown worth asking on a question just reported: `not-run` when the workspace has no Jev key or
 * the decision is Off, `set-aside` when Jev's "no" counted, `kept` otherwise.
 */
export async function judgeQuestion(deps: JudgeDeps, { question, link }: Reported): Promise<'not-run' | 'set-aside' | 'kept'> {
  try {
    const workspace = await deps.linkWorkspace(link);
    if (!workspace || !(await jevSetUp(deps.jev, workspace))) return 'not-run';
    const found = await deps.context(question);
    if (!found || found.workspace !== workspace) return 'kept';
    const counted = await decide(deps.jev, {
      workspace, entry: unknownWorthAsking, input: found.input, old: () => Promise.resolve(true), ref: `agent question ${question}`,
    });
    if (counted.decidedBy !== 'jev' || counted.value !== false) return 'kept';
    await deps.setAside(question);
    return 'set-aside';
  } catch (err) {
    console.error(`agent-questions: Unknown worth asking left question ${question} open (${why(err)})`);
    return 'kept';
  }
}
