import { pollDevice } from '../../../../../src/ask/device.controller';
import { deviceLive } from '../../../../../src/ask/device.live';

// POST /api/ask/device/poll {device_code} → {status: pending | slow_down | expired | denied | approved,
// …}: where a device sign-in request stands, its code or token handed over once approved (PRD 1660;
// src/ask/device.contract.ts for every answer).
export function POST(request: Request) {
  return pollDevice(request, { service: deviceLive() });
}
