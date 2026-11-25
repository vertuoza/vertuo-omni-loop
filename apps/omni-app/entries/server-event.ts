// `/api/server-event`: where galaxy tells the App that the server changed a product PRD (an approval, a
// void), signed with `STAGE_EVENT_SECRET` (../src/server-event/server-event.ts, PRD 1548 s4). The app's
// environment is read when this module loads (../src/env.ts): a half-set group, a malformed value, or in
// production a missing GITHUB_WEBHOOK_SECRET or GitHub App, fails the function's start with one error
// naming every variable concerned, never a value.
import { processEnv, readEnv } from '../src/env.ts';
import { recordAppErrorsOf } from '../src/run-log/app-errors.ts';
import { serverEventRoute } from '../src/server-event/server-event.ts';

const appEnv = readEnv(processEnv());
// Its 5xx are kept in `app_errors`, masked (PRD omni-loop-34 s2, ../src/run-log/app-errors.ts).
recordAppErrorsOf(appEnv);

export const { POST, GET } = serverEventRoute(appEnv);
