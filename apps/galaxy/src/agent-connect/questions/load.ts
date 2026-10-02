import { questionsOf, type AgentQuestion } from './model';

// The questions' read for Settings › Business (PRD 855 s3): the workspace's open questions, as the
// signed-in person. One the page can do without: unreadable (or a database from before PRD 855 s3), it
// reads as none, logged, so the business still opens.

type Rpc = { rpc(fn: string, args: Record<string, unknown>): PromiseLike<{ data: unknown; error: unknown }> };

export async function loadQuestions(db: Rpc, workspace: string): Promise<AgentQuestion[]> {
  const { data, error } = await db.rpc('agent_questions_list', { p_workspace: workspace });
  const questions = error ? null : questionsOf(data);
  if (!questions) {
    const why = error ? (error as { message?: unknown }).message : 'an unexpected answer'; // ts-allow: a PostgREST error carries a message; it is only logged
    console.error(`agent-questions: could not read the questions (${String(why)})`);
    return [];
  }
  return questions;
}
