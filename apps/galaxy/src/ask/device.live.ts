import 'server-only';
import { serviceDb } from '../data/sign-in-live';
import { serverEnv } from '../env';
import { kitBox } from './kit-token';
import { deviceRepository } from './device.repository';
import { deviceService, type DeviceService } from './device.service';

// The device sign-in (src/ask/device.service.ts says what each step does), wired to the real Supabase
// as the service role (SUPABASE_SERVICE_ROLE_KEY), the only role its functions let in, and to the
// server's key (KIT_TOKEN_KEY) that opens a kit token waiting sealed. Without Supabase or the service
// role there is no device sign-in here: the routes answer 503, and the kit falls back to its loopback.
// Without the key, a sign-in still works; only a token cannot be handed over.

/** The device sign-in, or null when this deployment has no database for it. */
export function deviceLive(): DeviceService | null {
  const env = serverEnv();
  if (!env.supabase || !env.serviceRole) return null;
  const box = kitBox(env.kitTokenKey);
  return deviceService(deviceRepository(serviceDb()), { open: box ? (sealed) => box.open(sealed) : null });
}
