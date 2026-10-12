import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import type { Database } from '../../../../supabase/database.types';
import type { DevicePayload, DeviceRow, DeviceStore } from './device.contract';

// The device sign-in's database calls (PRD 1660, s1; 20261205090000_ask_cli_devices.sql): the seven
// ask_cli_device_* functions, on the service role's client, the only role they let in. No rule lives
// here: src/ask/device.service.ts decides, and each call throws when the database fails.

type Db = SupabaseClient<Database>;

const RowSchema = z.object({
  status: z.enum(['pending', 'approved', 'denied']),
  purpose: z.enum(['signin', 'token']),
  name: z.string().nullable(),
  days: z.number().nullable(),
  workspace: z.string().nullable(),
  poll_interval: z.number(),
  last_polled_at: z.string().nullable(),
  expires_at: z.string(),
});

const PayloadSchema = z.object({ purpose: z.enum(['signin', 'token']), payload: z.string(), payload_expires_at: z.string().nullable() });

/** The first row a set-returning function answered, or null. */
const first = (data: unknown): unknown => (Array.isArray(data) ? (data[0] ?? null) : data);

function rowOf(data: unknown): DeviceRow | null {
  const row = first(data);
  if (row === null) return null;
  const { poll_interval: interval, ...rest } = RowSchema.parse(row);
  return { ...rest, interval };
}

/** Throws the database's refusal, named after the function. */
function called<T>(fn: string, { data, error }: { data: T; error: { message: string } | null }): T {
  if (error) throw new Error(`${fn}: ${error.message}`);
  return data;
}

/** The device store over `db`, the service role's client. */
export function deviceRepository(db: Db): DeviceStore {
  return {
    async issue({ device_hash, user_code, request, now, expires_at }) {
      const token = request.purpose === 'token' ? request : null;
      const stored = called('ask_cli_device_issue', await db.rpc('ask_cli_device_issue', {
        p_device_hash: device_hash, p_user_code: user_code, p_purpose: request.purpose,
        p_name: token?.name ?? null, p_days: token?.days ?? null, p_workspace: token?.workspace ?? null,
        p_now: now, p_expires_at: expires_at,
      }));
      return stored === true ? 'issued' : 'taken';
    },
    async read(deviceHash) {
      return rowOf(called('ask_cli_device_read', await db.rpc('ask_cli_device_read', { p_device_hash: deviceHash })));
    },
    async polled(deviceHash, at, interval) {
      called('ask_cli_device_polled', await db.rpc('ask_cli_device_polled', { p_device_hash: deviceHash, p_polled_at: at, p_interval: interval }));
    },
    async take(deviceHash): Promise<DevicePayload | null> {
      const row = first(called('ask_cli_device_take', await db.rpc('ask_cli_device_take', { p_device_hash: deviceHash })));
      return row === null ? null : PayloadSchema.parse(row);
    },
    async find(userCode) {
      return rowOf(called('ask_cli_device_find', await db.rpc('ask_cli_device_find', { p_user_code: userCode })));
    },
    async approve(userCode, purpose, payload, payloadExpiresAt, at) {
      const done = called('ask_cli_device_approve', await db.rpc('ask_cli_device_approve', {
        p_user_code: userCode, p_purpose: purpose, p_payload: payload, p_payload_expires_at: payloadExpiresAt, p_now: at,
      }));
      return done === true;
    },
    async deny(userCode, at) {
      return called('ask_cli_device_deny', await db.rpc('ask_cli_device_deny', { p_user_code: userCode, p_now: at })) === true;
    },
  };
}
