// PRD 1262: the People table says how many people it lists. One test per acceptance criterion a screen
// can show; criteria 2 (one person reads "1 person") and 4 (no line when the people cannot be read) are
// not filmable here and stay ordinary tests.
//
// The tests are written from the spec's criteria alone. Exact reads pin every outcome, so nothing here
// calls the model on a replay, and nothing names a person or a number of the demo world.
import { describe, test } from '@e2e-dev/web';
import { expect } from 'e2e';

const BOARD = '/app/workspace';

type Screen = Parameters<Parameters<typeof test>[2]>[0]['screen'];
const tableOf = (screen: Screen) => screen.getByRole('region', 'People');

/** The rows the People table lists, once the first body row is drawn (reads do not wait). */
async function rowCount(screen: Screen): Promise<number> {
  await expect(tableOf(screen).getByRole('row').nth(1)).toBeVisible();
  return (await tableOf(screen).getByRole('row').all()).length - 1;
}

/** The text of the line that says how many people the table lists. */
async function countLine(screen: Screen): Promise<string> {
  const line = tableOf(screen).getByText(/^\d+ (people|person)$/);
  await expect(line).toBeVisible();
  return ((await line.allTextContents())[0] ?? '').trim();
}

describe('PRD 1262 · People count', { tags: ['prd-1262'] }, () => {
  test('criterion 1: a line "N people" under the People heading, N being the number of rows', async ({ app, screen }) => {
    await app.open(BOARD);
    const rows = await rowCount(screen);
    expect(rows).toBeGreaterThan(1);
    expect(await countLine(screen)).toBe(`${rows} people`);
  });

  test('criterion 3: sorting by a header does not change the number the line shows', async ({ app, agent, screen, browser }) => {
    await app.open(BOARD);
    const before = await countLine(screen);
    await agent.act('in the People table, click the "Name" column header');
    await expect(browser).toHaveURL(/sort=name/);
    expect(await countLine(screen)).toBe(before);
    await agent.act('in the People table, click the "PRs" column header');
    await expect(browser).toHaveURL(/sort=prs/);
    expect(await countLine(screen)).toBe(before);
  });
});
