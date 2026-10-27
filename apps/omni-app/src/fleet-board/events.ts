// The fleet board's event (PRD 2530): a pull request the loop signed, open, into the repository's default
// branch, as the webhook hands it to the `fleet-board` function (./fleet-board.ts), which adds it to the
// GitHub project board of its author's fleet.
//
// The webhook reads no database, so it cannot tell whether the author is in a fleet, or whether that fleet
// has a board: it sends the event for every such pull request, and the function decides. It reads what it
// can from the delivery alone: the base, the state, the body's signature marker and the author.
import { z } from 'zod';
import { PrNumberSchema, type PrNumber } from 'omni-loop/kit/lib/ids.ts';

/** The event `/api/github` sends for a pull request the loop signed, open, into the default branch. */
export const FLEET_BOARD_EVENT = 'omni-loop/fleet-board.requested';

/** The event's data: where, which pull request (its number, node id and link), and who opened it. */
export const FleetBoardDataSchema = z.looseObject({
  installationId: z.number(),
  owner: z.string().min(1),
  repo: z.string().min(1),
  repository: z.string().regex(/^[^/\s]+\/[^/\s]+$/, 'owner/name'),
  prNumber: PrNumberSchema,
  /** The pull request's GraphQL node id, the card's content. */
  nodeId: z.string().min(1),
  /** The pull request's link, as a runner's job lists it. */
  url: z.string().min(1),
  /** The GitHub login of its author. */
  author: z.string().min(1),
});
export type FleetBoardData = z.infer<typeof FleetBoardDataSchema>;

/** One fleet board event, as the webhook sends it; its `id` makes a redelivery of the same change one run. */
export type FleetBoardRequest = { name: typeof FLEET_BOARD_EVENT; id: string; data: FleetBoardData };

/** The event's id: one per pull request, action and last update, so a delivery GitHub sends twice runs once. */
export function fleetBoardId({ repository, prNumber, action, at }: { repository: string; prNumber: PrNumber; action: string; at: string }): string {
  return `fleet-board:${repository.toLowerCase()}#${String(prNumber)}:${action}:${at}`;
}
