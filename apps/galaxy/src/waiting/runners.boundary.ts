import type { Boundary } from '../data/parse-rows';
import { JobStateRead, jobStateRows, OpenQuestionRead, openQuestionRows } from './waiting.repository';

// The Runners part's own reads (PRD 2255, s4), for `pnpm schemas:verify`: the jobs whose questions nobody
// has closed, and the state of the jobs that ended with an outcome, as the waiting repository reads them,
// across every workspace.
export const boundaries: Boundary[] = [
  {
    name: 'waiting/runners: runner_job_questions',
    read: (db) => openQuestionRows(db),
    schema: OpenQuestionRead,
    shape: 'rows',
  },
  {
    name: 'waiting/runners: runner_jobs',
    read: (db) => jobStateRows(db),
    schema: JobStateRead,
    shape: 'rows',
  },
];
