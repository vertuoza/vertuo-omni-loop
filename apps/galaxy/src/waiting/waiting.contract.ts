// What the waiting list's read routes answer (PRD 1318, s4; ADR-0095), as zod schemas both sides share:
// the controller (src/waiting/waiting.controller.ts) answers these shapes, and the browser's client
// (src/waiting/waiting.client.ts) parses every response with them. Browser-safe: zod and the kit's ids
// only.
//
//   GET /api/waiting/questions  → { questions: WaitingQuestion[] }   the Questions part (PRD 499)
//   GET /api/waiting/documents  → { documents: DocumentRow[] }       the New documents part (PRD 579)
//
// A refusal is `{ error: <kind> }`: 401 `signed-out`, 500 `database`.
import { z } from 'zod';
import { PrdNumberSchema } from 'vertuo-omni-plan/kit/lib/ids.ts';

const WAITING_ERRORS = ['signed-out', 'database'] as const;
export type WaitingErrorKind = (typeof WAITING_ERRORS)[number];

/** Every refusal of the waiting read routes. */
export const WaitingErrorSchema = z.object({ error: z.enum(WAITING_ERRORS) });

/** Each refusal's status. */
export const WAITING_ERROR_STATUS: Readonly<Record<WaitingErrorKind, number>> = { 'signed-out': 401, database: 500 };

/** A person's face (PRD 652), as src/people/face.ts decides it. */
const FaceSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('hero'), svg: z.string() }),
  z.object({ kind: z.literal('photo'), url: z.string() }),
  z.object({ kind: z.literal('initial'), letter: z.string() }),
]);

const WaitingQuestionSchema = z.object({
  kind: z.literal('question'),
  id: z.string(),
  sessionTitle: z.string(),
  question: z.string(),
  askedAt: z.number(),
  sharedBy: z.string().nullable(),
  sharedByFace: FaceSchema.exactOptional(),
});

export const QuestionsSchema = z.object({ questions: z.array(WaitingQuestionSchema) });

const DocumentRowSchema = z.object({
  id: z.string(),
  kind: z.enum(['spec', 'plan', 'before-after']),
  created_at: z.string(),
  dossier: z.object({ id: z.string(), prd: PrdNumberSchema, title: z.string() }),
});

export const DocumentsSchema = z.object({ documents: z.array(DocumentRowSchema) });
