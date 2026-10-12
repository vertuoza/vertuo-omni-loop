// The device sign-in's two routes (PRD 1660, s1; ./device.contract.ts for every answer):
// POST /api/ask/device issues a request, POST /api/ask/device/poll answers by its status. Each reads
// its body under MAX_TOKEN_BODY_BYTES, as /api/ask/token does, and every answer is no-store.
import 'server-only';
import { z } from 'zod';
import { messageOf } from 'vertuo-omni-plan/kit/lib/narrow.ts';
import { MAX_TOKEN_BODY_BYTES, refuse, reply } from './cli-code';
import type { PollAnswer } from './device.contract';
import { readDeviceRequest, type DeviceService } from './device.service';

export type DeviceRouteDeps = {
  /** The device sign-in, or null when this deployment has no database (or no service role) for it. */
  service: DeviceService | null;
  now?: () => number;
};

const NO_DATABASE = 'Device sign-in is not available here: this deployment has no database for it.';
const STORE_DOWN = 'The ask database could not answer. Try again.';

/** The body as JSON (undefined when it is not JSON), or the Response that refuses it for its size. */
async function bodyOf(request: Request, route: string): Promise<unknown> {
  const tooLarge = () => refuse(413, `A call to ${route} carries ${MAX_TOKEN_BODY_BYTES / 1024} KiB at most.`);
  if (Number(request.headers.get('content-length') ?? 0) > MAX_TOKEN_BODY_BYTES) return tooLarge();
  const text = await request.text();
  if (new TextEncoder().encode(text).length > MAX_TOKEN_BODY_BYTES) return tooLarge();
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

/** The site's own address as the browser sees it, behind Vercel's proxy too: the link the terminal prints. */
function originOf(request: Request): string {
  const url = new URL(request.url);
  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host');
  const proto = request.headers.get('x-forwarded-proto') ?? url.protocol.replace(':', '');
  return host ? `${proto}://${host}` : url.origin;
}

/** POST /api/ask/device: a pending request, its device code, its user code and the link to approve it. */
export async function issueDevice(request: Request, deps: DeviceRouteDeps): Promise<Response> {
  const body = await bodyOf(request, '/api/ask/device');
  if (body instanceof Response) return body;
  const asked = readDeviceRequest(body, new Date((deps.now ?? Date.now)()));
  if (!asked) {
    return refuse(400, 'The body must be {"purpose": "signin"}, or {"purpose": "token"} with "name", "days" (30, 90 or 365) and "workspace" if you like.');
  }
  if (!deps.service) return refuse(503, NO_DATABASE);
  try {
    const issued = await deps.service.issue(asked);
    const url = `${originOf(request)}/ask/device?${new URLSearchParams({ user_code: issued.user_code }).toString()}`;
    return reply(200, { device_code: issued.device_code, user_code: issued.user_code, url, interval: issued.interval, expires_in: issued.expires_in });
  } catch (error) {
    console.error(`ask device: ${messageOf(error)}`);
    return refuse(500, STORE_DOWN);
  }
}

const PollBody = z.strictObject({ device_code: z.string().min(1) });

const POLL_STATUS: Readonly<Record<PollAnswer['status'], number>> = { pending: 200, approved: 200, slow_down: 429, expired: 410, denied: 403 };

/** POST /api/ask/device/poll {device_code}: the request's status, and its payload once approved. */
export async function pollDevice(request: Request, deps: DeviceRouteDeps): Promise<Response> {
  const body = await bodyOf(request, '/api/ask/device/poll');
  if (body instanceof Response) return body;
  const parsed = PollBody.safeParse(body);
  if (!parsed.success) return refuse(400, 'The body must be {"device_code": "…"}.');
  if (!deps.service) return refuse(503, NO_DATABASE);
  try {
    const answer = await deps.service.poll(parsed.data.device_code);
    return reply(POLL_STATUS[answer.status], answer);
  } catch (error) {
    console.error(`ask device poll: ${messageOf(error)}`);
    return refuse(500, STORE_DOWN);
  }
}
