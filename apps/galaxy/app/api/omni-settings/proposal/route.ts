import { playbookProposalDeps } from '../../../../src/omni-settings/omni-settings-proposal-live';
import { proposePlaybookPage } from '../../../../src/omni-settings/omni-settings.controller';

// POST /api/omni-settings/proposal {workspace, form, text} → 200 {repository, pullRequest}: a workspace
// owner's change to a page of Settings → Playbook, opened as a pull request in the workspace's settings
// repository as the Omni app; nothing is stored here (src/omni-settings/omni-settings.controller.ts,
// PRD 2417 s7).
export const maxDuration = 60;

export function POST(request: Request) {
  return proposePlaybookPage(request, playbookProposalDeps());
}
