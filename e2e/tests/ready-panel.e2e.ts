import { test } from '@e2e-dev/web';
import { expect } from 'e2e';
import { processEnv } from '../../kit/lib/env/read.ts';

// PRD 2898, AC-9: the PRD page shows what ready proves. The PRD id comes from E2E_READY_PRD_PATH (the
// page of a mission PRD whose pull request is ready, on the app under test); a member's session is read by
// the app's own sign-in, never written here.
const PAGE = processEnv().E2E_READY_PRD_PATH ?? '/prd';

test('AC-9: The PRD page shows what ready proves', { tags: ['prd-2898'] }, async ({ app, agent, browser }) => {
  await app.open(PAGE);

  // Given a member signed in on the PRD page of a mission PRD whose PR is ready
  await agent.act('stay on the PRD page of a mission PRD whose pull request is ready, signed in as a member');

  // When they open its Ready panel
  await agent.act('open its Ready panel');

  // Then they see Ready for review · 5 of 5, each check with its proof link, each AC with its state, and the line Ready for review, not merged. Only a person merges.
  await expect(browser).toHaveURL(/\/prd\//);
  await agent.assert('the Ready panel reads Ready for review · 5 of 5, each check has its proof link, each AC shows its state, and the line Ready for review, not merged. Only a person merges. is shown');
});
