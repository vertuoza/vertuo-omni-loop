import 'server-only';
import { log } from 'omni-loop/kit/lib/log/log.ts';
import { serviceDb } from '../data/sign-in-live';
import { supabaseEnv } from '../data/supabase-server';
import { serverEnv } from '../env';
import { appErrorWriter, type AppError } from './app-errors';
import { appErrorsRepository } from './app-errors.repository';

// The galaxy's 5xx, for real (PRD omni-loop-34 s3): written as the service role; a deployment without one writes none.

/** Records one 5xx of the galaxy; never throws. */
export function recordAppError(error: AppError): Promise<void> {
  const store = supabaseEnv() !== null && serverEnv().serviceRole !== null ? appErrorsRepository(serviceDb()) : null;
  return appErrorWriter(store, (message) => { log.error({ event: 'app-errors', outcome: 'failed', message }); })(error);
}
