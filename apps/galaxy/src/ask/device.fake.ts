// The device table and its functions in memory, for the device sign-in's tests (PRD 1660, s1): the
// rules 20261205090000_ask_cli_devices.sql keeps, each function's guard included.
import type { DevicePayload, DeviceRow, DeviceStore } from './device.contract';

type Stored = DeviceRow & { device_hash: string; user_code: string; payload: string | null; payload_expires_at: string | null };

/** A fresh store: its rows by device hash, and a switch that makes every call fail. */
export function fakeStore() {
  const rows = new Map<string, Stored>();
  const state = { fails: false };
  /** A round trip to the database: refused while `state.fails`. */
  const fail = (): Promise<void> => (state.fails ? Promise.reject(new Error('ask_cli_device: the database is down')) : Promise.resolve());
  const byUserCode = (userCode: string) => [...rows.values()].find((row) => row.user_code === userCode) ?? null;
  const view = (row: Stored): DeviceRow => ({
    status: row.status, purpose: row.purpose, name: row.name, days: row.days, workspace: row.workspace,
    interval: row.interval, last_polled_at: row.last_polled_at, expires_at: row.expires_at,
  });
  const store: DeviceStore = {
    async issue({ device_hash, user_code, request, now, expires_at }) {
      await fail();
      for (const [hash, row] of rows) if (row.expires_at < now) rows.delete(hash);
      if (byUserCode(user_code)) return 'taken';
      rows.set(device_hash, {
        device_hash, user_code, status: 'pending', purpose: request.purpose,
        name: request.purpose === 'token' ? request.name : null,
        days: request.purpose === 'token' ? request.days : null,
        workspace: request.purpose === 'token' ? request.workspace : null,
        interval: 3, last_polled_at: null, expires_at, payload: null, payload_expires_at: null,
      });
      return 'issued';
    },
    async read(deviceHash) {
      await fail();
      const row = rows.get(deviceHash);
      return row ? view(row) : null;
    },
    async polled(deviceHash, at, interval) {
      await fail();
      const row = rows.get(deviceHash);
      if (row?.status === 'pending') Object.assign(row, { last_polled_at: at, interval });
    },
    async take(deviceHash) {
      await fail();
      const row = rows.get(deviceHash);
      if (row?.status !== 'approved' || row.payload === null) return null;
      rows.delete(deviceHash);
      const taken: DevicePayload = { purpose: row.purpose, payload: row.payload, payload_expires_at: row.payload_expires_at };
      return taken;
    },
    async find(userCode) {
      await fail();
      const row = byUserCode(userCode);
      return row ? view(row) : null;
    },
    async approve(userCode, purpose, payload, payloadExpiresAt, at) {
      await fail();
      const row = byUserCode(userCode);
      if (!row || row.status !== 'pending' || row.purpose !== purpose || !(row.expires_at > at)) return false;
      Object.assign(row, { status: 'approved', payload, payload_expires_at: payloadExpiresAt });
      return true;
    },
    async deny(userCode, at) {
      await fail();
      const row = byUserCode(userCode);
      if (!row || row.status !== 'pending' || !(row.expires_at > at)) return false;
      row.status = 'denied';
      return true;
    },
  };
  return { store, rows, state };
}
