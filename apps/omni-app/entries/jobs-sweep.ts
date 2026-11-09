// `/api/jobs-sweep`: the jobs due, the hourly comparison and a replay by hand (../src/jobs/sweep.ts), under
// `CRON_SECRET`. The app's environment is read when this module loads (../src/env.ts), as `entries/github.ts`
// does: a half-set group or a malformed value fails the function's start with one error naming the variable.
import { processEnv, readEnv } from '../src/env.ts';
import { jobsSweepRoute } from '../src/jobs/sweep.ts';

export const { GET, POST, PUT, PATCH, DELETE } = jobsSweepRoute(readEnv(processEnv()));
