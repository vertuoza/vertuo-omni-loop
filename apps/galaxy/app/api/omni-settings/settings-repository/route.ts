import { settingsRepositoryDeps } from '../../../../src/omni-settings/omni-settings-choice-live';
import { chooseSettingsRepository } from '../../../../src/omni-settings/omni-settings.controller';

// POST /api/omni-settings/settings-repository {workspace, repository} → 200 {repository}: a workspace
// owner's choice of the repository that holds the playbook, stored by the database's owner-only function
// as the signed-in person; `repository` null clears it (src/omni-settings/omni-settings.controller.ts,
// PRD 2543 s3).
export function POST(request: Request) {
  return chooseSettingsRepository(request, settingsRepositoryDeps());
}
