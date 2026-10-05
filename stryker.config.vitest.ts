// The tests mutation runs against (PRD 1072): the kit library's own, which run in seconds in one
// process. The command tests under `kit/bin` and `scripts/` spawn git and node, take minutes as a
// suite and time out under load, and a mutant in code that runs when its module loads (a zod schema)
// reruns every test it may reach: with them, a full run of the delivery core took hours.
import base, { TEST_TIMEOUT_MS } from './vitest.config.ts';

export default {
  test: {
    ...base.test,
    include: ['kit/lib/**/*.test.ts'],
    testTimeout: TEST_TIMEOUT_MS,
  },
};
