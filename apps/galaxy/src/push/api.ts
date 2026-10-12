import { z } from 'zod';
import { refuse, reply } from '../business-api/reply';
import { messageOf } from 'vertuo-omni-plan/kit/lib/narrow.ts';
import { AlertChannels, PushDevice } from './device';
import type { AlertStore } from './store';

// The profile page's alert routes (PRD 1322 s9), as plain functions of a Request so each route file
// stays one line. Each acts as the signed-in person, on their own rows only (./store.ts):
//
//   POST   /api/push/channels      {push, email}                 200 {channels}: both switches, saved
//   POST   /api/push/subscription  {endpoint, keys, label}       200 {subscribed: true}: this device, stored
//   DELETE /api/push/subscription  {endpoint}                    200 {subscribed: false}: this device, removed
//
// Refusals, each `{error}` in plain words: 400 a malformed body, 401 signed out, 500 the database failed.

/** The signed-in person and their store, or null when nobody is signed in (or there is no database). */
export interface AlertRouteDeps {
  session: () => Promise<{ userId: string; store: AlertStore } | null>;
}

export const SIGN_IN_FIRST = 'Sign in first.';
const COULD_NOT_SAVE = 'The database could not answer. Try again.';

const Unsubscribe = z.object({ endpoint: PushDevice.shape.endpoint });

async function bodyOf<T>(request: Request, schema: z.ZodType<T>): Promise<T | null> {
  const sent: unknown = await request.json().catch(() => null);
  const parsed = schema.safeParse(sent);
  return parsed.success ? parsed.data : null;
}

/** Runs `act` as the signed-in person on a body `schema` reads; refuses as the header says. */
async function asPerson<T>(
  request: Request, deps: AlertRouteDeps, schema: z.ZodType<T>, malformed: string, what: string,
  act: (store: AlertStore, userId: string, body: T) => Promise<unknown>,
): Promise<Response> {
  const session = await deps.session();
  if (!session) return refuse(401, SIGN_IN_FIRST);
  const body = await bodyOf(request, schema);
  if (body === null) return refuse(400, malformed);
  try {
    return reply(200, await act(session.store, session.userId, body));
  } catch (error) {
    console.error(`push: ${what} failed (${messageOf(error)})`);
    return refuse(500, COULD_NOT_SAVE);
  }
}

export function setChannelsRoute(request: Request, deps: AlertRouteDeps): Promise<Response> {
  return asPerson(request, deps, AlertChannels, 'Send both switches, push and email, each true or false.', 'saving the channels',
    async (store, userId, channels) => ({ channels: await store.setChannels(userId, channels) }));
}

export function subscribeRoute(request: Request, deps: AlertRouteDeps): Promise<Response> {
  return asPerson(request, deps, PushDevice, 'Send this device’s subscription: its https endpoint, its two keys and a label.', 'subscribing a device',
    async (store, userId, device) => {
      await store.subscribe(userId, device);
      return { subscribed: true };
    });
}

export function unsubscribeRoute(request: Request, deps: AlertRouteDeps): Promise<Response> {
  return asPerson(request, deps, Unsubscribe, 'Send this device’s https endpoint.', 'unsubscribing a device',
    async (store, userId, { endpoint }) => {
      await store.unsubscribe(userId, endpoint);
      return { subscribed: false };
    });
}
