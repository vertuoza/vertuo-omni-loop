// A mission request as the Omni page answers it (PRD omni-loop-24 s5): the goal a person typed in the New mission box and the
// fleet they picked, read by `omni mission request <id>` so the goal never travels in a runner job's line. The shape mirrors the
// page's `GET /api/missions/requests/<id>`; the kit reads only what it needs, and anything else is one line, never a throw.
import { field } from '../ask/schema.ts';

/** What the skill needs of a request. */
export type MissionRequestView = { fleet: string; goal: string };

const REQUEST_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Whether `value` is a request's id, a uuid. */
export const isRequestId = (value: string): boolean => REQUEST_ID.test(value);

const text = (value: unknown): string | null => (typeof value === 'string' && value.trim() !== '' ? value : null);

/** The request inside the page's reply, or null when the reply holds no goal and fleet. */
export function readRequest(reply: unknown): MissionRequestView | null {
  const request = field(reply, 'request');
  const fleet = text(field(request, 'fleet'));
  const goal = text(field(request, 'goal'));
  return fleet === null || goal === null ? null : { fleet, goal };
}

/** The lines `omni mission request` prints: the fleet, then the goal word for word (BL-ASK-1). */
export const requestLines = ({ fleet, goal }: MissionRequestView): string[] => [`fleet: ${fleet}`, `goal: ${goal}`];
