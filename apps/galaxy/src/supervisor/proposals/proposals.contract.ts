import { z } from 'zod';

// An owner's press of one of the Supervisor's suggestions, and their Not a problem (PRD omni-loop-34 s7; ADR-0095),
// browser-safe: what the Supervisor page sends to `/api/supervisor/proposals` and gets back. The rows are
// supabase/migrations/20270129160000_supervisor.sql's `supervisor_proposals` (append-only: a press, its result and a
// dismissal are written once, BR-PRODUCT-12).

/** The actions a press carries out. `open-terminal` and `open-mission` are links the page follows: nothing is pressed. */
export const PRESSED_ACTIONS = ['stop-resume-job', 'open-bug-fix', 'pause-mission', 'resume-mission', 'wake-mission', 'clean-worktrees', 'copy-kit-update'] as const;
export type PressedAction = (typeof PRESSED_ACTIONS)[number];
const LINK_ACTIONS = ['open-terminal', 'open-mission'] as const;
/** Whether a suggestion's action is a link the page follows. */
export const isLinkAction = (action: string | null): boolean => LINK_ACTIONS.some((link) => link === action);

const Id = z.uuid();

export const PressRequestSchema = z.strictObject({ workspace: Id, proposal: Id });

export const DismissRequestSchema = z.strictObject({ workspace: Id, finding: Id, reason: z.string().trim().max(500).optional() });

// ── What each suggestion names, in its `target` ──────────────────────────────

export const JobTargetSchema = z.object({ job: Id });
export const MissionTargetSchema = z.object({ mission: Id });
export const RunnerTargetSchema = z.object({ runner: Id });
/** The fixed fields of an Omni Loop bug report (kit/lib/repair/scrub.ts's input): scrubbed before anything is queued. */
export const BugTargetSchema = z.object({
  kitVersion: z.string().min(1).max(40),
  command: z.string().min(1).max(200),
  class: z.string().min(1).max(40),
  message: z.string().min(1).max(2000),
  fingerprint: z.string().min(1).max(64),
});

// ── Answers ───────────────────────────────────────────────────────────────────

const OUTCOMES = ['done', 'refused', 'failed'] as const;
export type Outcome = (typeof OUTCOMES)[number];

/** A press as it ended: its outcome and why, the finding's state after it, and the line posted in its thread. */
export const PressReplySchema = z.object({
  press: z.object({
    proposal: z.string(),
    action: z.enum(PRESSED_ACTIONS),
    outcome: z.enum(OUTCOMES),
    note: z.string(),
    by: z.string(),
    finding: z.object({ id: z.string(), state: z.enum(['open', 'acted', 'dismissed', 'resolved']) }),
    /** The steps to copy, for `clean-worktrees` and `copy-kit-update`; null for any other action. */
    steps: z.string().nullable(),
  }),
});
export type Pressed = z.infer<typeof PressReplySchema>['press'];

export const DismissReplySchema = z.object({ dismissed: z.object({ finding: z.string(), by: z.string(), reason: z.string().nullable() }) });
export type Dismissed = z.infer<typeof DismissReplySchema>['dismissed'];

// ── The words ─────────────────────────────────────────────────────────────────

/** AC-4: a lost job whose automatic resume exists is never queued twice (BR-PRODUCT-136). */
export const RESUME_QUEUED = 'Its automatic resume is already queued';
export const JOB_ENDED = 'The job ended already: there is nothing to stop';
export const STOP_ASKED = 'Someone asked this job to stop already';
export const JOB_GONE = 'The job is no longer in this workspace';
export const MISSION_GONE = 'The mission is no longer in this workspace';
export const RUNNER_GONE = 'The runner is no longer in this workspace';
export const OWNERS_ONLY = 'Only a workspace owner acts on the Supervisor\'s suggestions.';
