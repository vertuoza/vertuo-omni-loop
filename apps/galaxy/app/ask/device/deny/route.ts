import { denyDevice } from '../../../../src/ask/device-card.controller';
import { deviceLive } from '../../../../src/ask/device.live';

// POST /ask/device/deny {user_code}: No, it's not mine, on the device page (PRD 1660). The pending
// request is refused, and the terminal's next poll reads denied (src/ask/device-card.controller.ts).
export function POST(request: Request) {
  return denyDevice(request, deviceLive());
}
