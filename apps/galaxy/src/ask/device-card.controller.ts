// The device page, /ask/device (PRD 1660; the `ask-device` screen): which state it shows for its link,
// and what No does. The link carries the request's user code; the page shows it and asks whether the
// terminal shows it before any sign-in. Yes opens the existing sign-in card, its way back the auth
// callback's device= branch (./cli-code.ts); No marks the request denied. Nothing here signs anyone in.
import 'server-only';
import { messageOf } from 'vertuo-omni-plan/kit/lib/narrow.ts';
import type { CardPurpose } from './cli-code-card';
import { deviceCallbackPath, devicePagePath } from './cli-code';
import type { DeviceCardView } from './device-card';
import type { DeviceService } from './device.service';

/** The page's query, each parameter's first value. */
export type DeviceQuery = Partial<Record<'user_code' | 'yes' | 'done' | 'denied' | 'signin_error', string>>;

const QUERY_KEYS = ['user_code', 'yes', 'done', 'denied', 'signin_error'] as const;

/** The page's search parameters as it reads them: the first value of each it knows. */
export function readDeviceQuery(raw: Record<string, string | string[] | undefined>): DeviceQuery {
  const query: DeviceQuery = {};
  for (const key of QUERY_KEYS) {
    const value = raw[key];
    const first = Array.isArray(value) ? value[0] : value;
    if (first !== undefined) query[key] = first;
  }
  return query;
}

/** What the page shows: one of the card's own states, the sign-in card, or a notice. */
export type DeviceView =
  | DeviceCardView
  | { kind: 'signin'; returnPath: string; purpose: CardPurpose; error: string | null }
  | { kind: 'closed' }
  | { kind: 'unreachable' };

/** The state for this link: done and denied as they are; with no device sign-in here, closed; with no
 * code, the box; a code not pending (expired, unknown, used, denied or malformed), expired; a pending
 * one, the question, or the sign-in card once Yes was pressed. */
export async function deviceView(query: DeviceQuery, service: DeviceService | null): Promise<DeviceView> {
  if (query.done) return { kind: 'done' };
  if (query.denied) return { kind: 'denied' };
  if (!service) return { kind: 'closed' };
  const given = (query.user_code ?? '').trim();
  if (!given) return { kind: 'enter' };
  let found;
  try {
    found = await service.find(given);
  } catch (error) {
    console.error(`ask device page: ${messageOf(error)}`);
    return { kind: 'unreachable' };
  }
  if (!found) return { kind: 'expired' };
  if (!query.yes) return { kind: 'confirm', userCode: found.user_code };
  const { request } = found;
  const purpose: CardPurpose = request.purpose === 'token'
    ? { kind: 'token', name: request.name, days: request.days, toTerminal: true }
    : { kind: 'signin' };
  return { kind: 'signin', returnPath: deviceCallbackPath(found.user_code, request.purpose), purpose, error: query.signin_error ?? null };
}

/** A 303 to the device page: the browser follows it with a GET. */
const seeOther = (params: Record<string, string> = {}) => new Response(null, { status: 303, headers: { location: devicePagePath(params) } });

/** POST /ask/device/deny {user_code}: No, it's not mine. The pending request is marked denied and the
 * page says nothing was signed in; one no longer pending is left as it is, and the page shows its
 * state; when the database fails, the page shows the code again so No can be pressed again. */
export async function denyDevice(request: Request, service: DeviceService | null): Promise<Response> {
  const form = await request.formData().catch(() => null);
  const given = form?.get('user_code');
  const userCode = typeof given === 'string' ? given.trim() : '';
  if (!userCode) return seeOther();
  const back = seeOther({ user_code: userCode });
  if (!service) return back;
  try {
    return (await service.deny(userCode)) ? seeOther({ denied: '1' }) : back;
  } catch (error) {
    console.error(`ask device deny: ${messageOf(error)}`);
    return back;
  }
}
