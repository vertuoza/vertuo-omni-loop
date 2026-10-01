import { z } from 'zod';

// Questions agents couldn't answer (PRD 855 s3): what Settings › Business shows of a question an editor's
// agent reported through report_unknown, as agent_questions_list() answers it — the question, the link
// that asked it last ("Tom's editor"), the repository and file it worked on, how often it was asked, when,
// and the product an answer goes to when the database can tell (the repository's, or the only one), and
// whether Jev set it aside (PRD 855 s4).

const agentQuestionSchema = z.object({
  id: z.string().min(1),
  question: z.string().min(1).max(300),
  asked: z.number().int().min(1),
  askedBy: z.string().min(1),
  repo: z.string().nullable(),
  file: z.string().nullable(),
  firstAskedAt: z.string(),
  lastAskedAt: z.string(),
  product: z.string().nullable(),
  /** Set aside by Jev's Unknown worth asking (PRD 855 s4): folded, with Bring back, not in the bell. */
  setAside: z.boolean().optional(),
});

export type AgentQuestion = z.infer<typeof agentQuestionSchema>;

/** The questions as the database answered them, or null when the answer is not a list of them. */
export function questionsOf(value: unknown): AgentQuestion[] | null {
  const read = z.array(agentQuestionSchema).safeParse(value);
  return read.success ? read.data : null;
}
