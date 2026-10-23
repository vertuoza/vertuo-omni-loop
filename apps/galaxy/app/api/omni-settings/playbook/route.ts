import { omniSettingsDeps } from '../../../../src/omni-settings/omni-settings-live';
import { readSettingsPlaybook } from '../../../../src/omni-settings/omni-settings.controller';

// GET /api/omni-settings/playbook?repo=<owner/name> → 200 {repository, commit, files, reason}: the
// tech playbook of the repository's workspace's settings repository, which `omni sync` copies
// (src/omni-settings/omni-settings.controller.ts, PRD 2417 s3).
export const maxDuration = 60;

export function GET(request: Request) {
  return readSettingsPlaybook(request, omniSettingsDeps());
}
