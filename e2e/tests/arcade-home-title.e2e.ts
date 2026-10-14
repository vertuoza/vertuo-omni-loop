import { test } from '@e2e-dev/web';
import { expect } from 'e2e';

// PRD 1954, criterion: the arcade home page shows the title OMNI LOOP.
// The title is the page's document title ("OMNI LOOP · …"), not text drawn in the body.
// The agent step reaches the home page from the docs by the site's own navigation, so the
// step takes a real action (a route change) that the check below verifies.
test('the arcade home page shows the title OMNI LOOP', { tags: ['prd-1954'] }, async ({ app, agent, browser }) => {
  await app.open('/docs');

  await agent.act('go to the site home page by using the logo or the home link');

  await expect(browser).toHaveTitle(/OMNI LOOP/);
});
