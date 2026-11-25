// The watch's reads (./store.ts), for `pnpm schemas:verify` (PRD 1030): the seats, a seat, the runners and their samples,
// the jobs, a job's last line, the missions, their events, runs and repairs, the App errors, the long-term notes, the open
// signals, the linked findings and the dismissals, parsed with the schemas the store parses them with. Its writes are not
// here: it writes, and the check only reads.
import type { Boundary } from '../boundary.ts';
import {
  ContinuesRowSchema, DISMISSAL, DismissalRowSchema, ErrorRowSchema, EventAtRowSchema, FAILED_JOB, FailedJobRowSchema, FINDING, FindingRowSchema,
  JOB, JobRowSchema, LaneRowSchema, LedgerRowSchema, LineAtRowSchema, MISSION, MissionRowSchema, NoteRowSchema, RepairRowSchema, RUNNER,
  RunnerRowSchema, SAMPLE, SampleRowSchema, SEAT, SEAT_LANES, SeatRowSchema, SIGNAL, SignalRowSchema,
} from './store.ts';

export const boundaries: Boundary[] = [
  { name: 'supervisor/store: seat lanes', read: (db) => db.from('supervisor_seats').select(SEAT_LANES).limit(5), schema: LaneRowSchema, shape: 'rows' },
  { name: 'supervisor/store: seat', read: (db) => db.from('supervisor_seats').select(SEAT).limit(5), schema: SeatRowSchema, shape: 'rows' },
  { name: 'supervisor/store: runners', read: (db) => db.from('runners').select(RUNNER).limit(5), schema: RunnerRowSchema, shape: 'rows' },
  { name: 'supervisor/store: samples', read: (db) => db.from('runner_samples').select(SAMPLE).limit(5), schema: SampleRowSchema, shape: 'rows' },
  { name: 'supervisor/store: jobs', read: (db) => db.from('runner_jobs').select(JOB).limit(5), schema: JobRowSchema, shape: 'rows' },
  { name: 'supervisor/store: failed jobs', read: (db) => db.from('runner_jobs').select(FAILED_JOB).eq('status', 'failed').limit(5), schema: FailedJobRowSchema, shape: 'rows' },
  { name: 'supervisor/store: continued jobs', read: (db) => db.from('runner_jobs').select('continues').limit(5), schema: ContinuesRowSchema, shape: 'rows' },
  { name: 'supervisor/store: a job\'s last line', read: (db) => db.from('runner_job_lines').select('at').limit(5), schema: LineAtRowSchema, shape: 'rows' },
  { name: 'supervisor/store: missions', read: (db) => db.from('missions').select(MISSION).limit(5), schema: MissionRowSchema, shape: 'rows' },
  { name: 'supervisor/store: mission events', read: (db) => db.from('mission_events').select('at').limit(5), schema: EventAtRowSchema, shape: 'rows' },
  { name: 'supervisor/store: ledger runs', read: (db) => db.from('background_jobs').select('kind, state').limit(5), schema: LedgerRowSchema, shape: 'rows' },
  { name: 'supervisor/store: mission repairs', read: (db) => db.from('mission_repairs').select('fingerprint').limit(5), schema: RepairRowSchema, shape: 'rows' },
  { name: 'supervisor/store: App errors', read: (db) => db.from('app_errors').select('route, status, created_at').limit(5), schema: ErrorRowSchema, shape: 'rows' },
  { name: 'supervisor/store: long-term notes', read: (db) => db.from('supervisor_memory').select('line').eq('scope', 'long').limit(5), schema: NoteRowSchema, shape: 'rows' },
  { name: 'supervisor/store: open signals', read: (db) => db.from('supervisor_signals').select(SIGNAL).is('closed_at', null).limit(5), schema: SignalRowSchema, shape: 'rows' },
  { name: 'supervisor/store: findings', read: (db) => db.from('supervisor_findings').select(FINDING).limit(5), schema: FindingRowSchema, shape: 'rows' },
  { name: 'supervisor/store: dismissals', read: (db) => db.from('supervisor_proposals').select(DISMISSAL).eq('kind', 'dismiss').limit(5), schema: DismissalRowSchema, shape: 'rows' },
];
