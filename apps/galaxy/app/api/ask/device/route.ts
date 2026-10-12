import { issueDevice } from '../../../../src/ask/device.controller';
import { deviceLive } from '../../../../src/ask/device.live';

// POST /api/ask/device {purpose: signin | token, name?, days?, workspace?} → {device_code, user_code,
// url, interval, expires_in}: a device sign-in request for a terminal the browser cannot reach
// (PRD 1660; src/ask/device.contract.ts for every answer).
export function POST(request: Request) {
  return issueDevice(request, { service: deviceLive() });
}
