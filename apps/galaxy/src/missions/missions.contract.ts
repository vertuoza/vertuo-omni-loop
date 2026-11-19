import { PrdNumberSchema } from 'omni-loop/kit/lib/ids.ts';
import { MISSION_LEVELS } from 'omni-loop/kit/lib/mission/brief.ts';
import { z } from 'zod';

// The missions' contract (PRD 2842 s5; spec "3. The supervisor"): what the Start, Pause and Resume routes
// answer, safe for the browser. A member of the mission's workspace moves it; the answer is the mission as
// moved. Every refusal is `{error}` in plain words.
//
//   POST /api/missions/<id>/start    a draft goes running
//   POST /api/missions/<id>/pause    a running or waiting mission goes paused
//   POST /api/missions/<id>/resume   a paused mission goes running; so does a stopped one (PRD 2980: Resume opens a new round of repairs)
//   POST /api/missions/<id>/level    {level}: Change for this mission (PRD 2896), the level it runs at
//   POST /api/missions/<id>/tokens   {tokens}: the mission's token budget, or null for none (PRD 3040)
//   POST /api/missions/stops/<stop>  {answer, tokens?}: a budget stop answered once (PRD 3040)
//   POST /api/missions/<id>/stop     a mission paused by stuck ends stopped, saying it was stuck (PRD 3065)
//   POST /api/missions/items/<item>  {answer, note?}: a mission item adopted or declined, once (PRD 3065)
//   POST /api/missions/<id>/bugs     {prd, pick}: a person's pick on Decide the bugs (PRD 3001), send the PRD on to the Reviewer or stop it

export type MissionAction = 'start' | 'pause' | 'resume';

const MISSION_STATUSES = ['draft', 'running', 'waiting', 'paused', 'delivered', 'stopped'] as const;
export const MissionStatusSchema = z.enum(MISSION_STATUSES);
export type MissionStatus = z.infer<typeof MissionStatusSchema>;

/** What each action does: the statuses it leaves, the one it goes to, the event it records and whether it wakes the supervisor. */
export const MOVES: Record<MissionAction, { from: readonly MissionStatus[]; to: MissionStatus; event: 'started' | 'paused' | 'resumed'; wakes: boolean }> = {
  start: { from: ['draft'], to: 'running', event: 'started', wakes: true },
  pause: { from: ['running', 'waiting'], to: 'paused', event: 'paused', wakes: false },
  resume: { from: ['paused', 'stopped'], to: 'running', event: 'resumed', wakes: true },
};

export const MovedMissionSchema = z.object({ mission: z.object({ id: z.uuid(), status: MissionStatusSchema }) });
export type MovedMission = z.infer<typeof MovedMissionSchema>;

/** What a mission runs at (PRD 2896): the brief's three keys. */
export const MissionLevelSchema = z.enum(MISSION_LEVELS);
export const LevelBodySchema = z.object({ level: MissionLevelSchema });
export const LeveledMissionSchema = z.object({ mission: z.object({ id: z.uuid(), level: MissionLevelSchema }) });
export type LeveledMission = z.infer<typeof LeveledMissionSchema>;

/** A mission's token budget (PRD 3040): a whole number from 1 to 10⁹, or null for none. */
const TOKENS_MAX = 1_000_000_000;
export const TokensBodySchema = z.object({ tokens: z.number().int().min(1).max(TOKENS_MAX).nullable() });
export const BudgetedMissionSchema = z.object({ mission: z.object({ id: z.uuid(), tokens: z.number().int().positive().nullable() }) });
export type BudgetedMission = z.infer<typeof BudgetedMissionSchema>;

/** A person's answer to a budget stop (PRD 3040): raise the cap (to `tokens`), resume tomorrow (a fleet's cap) or stop the mission. */
const STOP_ANSWERS = ['raised', 'tomorrow', 'stopped'] as const;
export const StopAnswerSchema = z.enum(STOP_ANSWERS);
export type StopAnswer = z.infer<typeof StopAnswerSchema>;
export const StopAnswerBodySchema = z.object({ answer: StopAnswerSchema, tokens: z.number().int().positive().optional() });
export type StopAnswerBody = z.infer<typeof StopAnswerBodySchema>;
export const AnsweredStopSchema = z.object({ stop: z.object({ id: z.uuid(), answer: StopAnswerSchema, raisedTo: z.number().int().positive().nullable() }) });
export type AnsweredStop = z.infer<typeof AnsweredStopSchema>;

/** A person's pick on `Decide the bugs` (PRD 3001): send the PRD on to the Reviewer with its bugs open, or stop it. */
const BugsPickSchema = z.enum(['review', 'stop']);
export type BugsPick = z.infer<typeof BugsPickSchema>;
export const BugsBodySchema = z.object({ prd: PrdNumberSchema, pick: BugsPickSchema });
export type BugsBody = z.infer<typeof BugsBodySchema>;
export const PickedBugsSchema = z.object({ bugs: z.object({ mission: z.uuid(), prd: PrdNumberSchema, pick: BugsPickSchema }) });
export type PickedBugs = z.infer<typeof PickedBugsSchema>;

/** What `omni mission drop` sends (PRD 2896 s7): the repository, the mission's number, the PRD to take off its branch and whether the later PRDs sharing its territory stay. */
export const DropBodySchema = z.object({
  repo: z.string().regex(/^[\w.-]+\/[\w.-]+$/).max(200),
  mission: z.number().int().positive(),
  prd: PrdNumberSchema,
  keep: z.boolean().default(false),
});
export type DropBody = z.infer<typeof DropBodySchema>;

/** The ask as recorded: the branch the PRD leaves, the later PRDs sharing its territory and every PRD that leaves, in join order. */
export const DroppedMissionSchema = z.object({
  drop: z.object({
    mission: z.uuid(),
    branch: z.string(),
    prd: PrdNumberSchema,
    sharing: z.array(PrdNumberSchema),
    dropped: z.array(PrdNumberSchema),
    keep: z.boolean(),
  }),
});
export type DroppedMission = z.infer<typeof DroppedMissionSchema>;

/** What `omni mission overturn` sends (PRD 2896 s11): the repository, the mission's number and the decision (`<prd>` or `<prd>/<item>`). */
export const OverturnBodySchema = z.object({
  repo: z.string().regex(/^[\w.-]+\/[\w.-]+$/).max(200),
  mission: z.number().int().positive(),
  decision: z.string().regex(/^[1-9][0-9]*(?:\/[a-z0-9][a-z0-9-]*)?$/).max(200),
});
export type OverturnBody = z.infer<typeof OverturnBodySchema>;

/** The overturn as recorded: the branch the PRD leaves (null when it was not on it), the decision, its PRD and whether it was on the branch. */
export const OverturnedMissionSchema = z.object({
  overturn: z.object({ mission: z.uuid(), branch: z.string().nullable(), decision: z.string(), prd: PrdNumberSchema, onBranch: z.boolean() }),
});
export type OverturnedMission = z.infer<typeof OverturnedMissionSchema>;

/** A member's answer to a mission item (PRD 3065): Adopt or Decline, with an optional note; written once, never rewritten. */
const ITEM_ANSWERS = ['adopted', 'declined'] as const;
export const ItemAnswerSchema = z.enum(ITEM_ANSWERS);
export type ItemAnswer = z.infer<typeof ItemAnswerSchema>;
export const ItemAnswerBodySchema = z.object({ answer: ItemAnswerSchema, note: z.string().trim().min(1).max(500).optional() });
export type ItemAnswerBody = z.infer<typeof ItemAnswerBodySchema>;
export const AnsweredItemSchema = z.object({ item: z.object({ id: z.uuid(), answer: ItemAnswerSchema }) });
export type AnsweredItem = z.infer<typeof AnsweredItemSchema>;

/** Each refusal's status. */
export const MISSION_REFUSALS = {
  malformed: 400,
  'signed-out': 401,
  forbidden: 403,
  missing: 404,
  conflict: 409,
  database: 500,
  unavailable: 503,
} as const;
export type MissionRefusal = keyof typeof MISSION_REFUSALS;
