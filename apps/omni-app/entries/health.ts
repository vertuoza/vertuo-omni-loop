// `/api/health` (PRD 1723): whether this deployment is alive, which commit it runs and whether its
// environment parses (../src/health/health.ts). Unlike the other entries it reads the environment on
// each request, never when it loads, so a broken environment answers 503 rather than failing the start.
import { processEnv } from '../src/env.ts';
import { healthRoute } from '../src/health/health.ts';

export const { GET, POST, PUT, PATCH, DELETE } = healthRoute(processEnv);
