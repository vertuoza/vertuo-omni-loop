import { describe, expect, it } from 'vitest';
import { appFunctions } from './functions.ts';

describe('appFunctions — none left on Inngest (PRD omni-loop-4 s4)', () => {
  it('serves no function: the main watch, the retro, the knowledge harvest, the knowledge pack, the pull-request checks, the pr-stats collector, the escalation, the fix row stamp, the fleet board, the canon buttons and the server event are jobs of the ledger (PRD 2676, PRD 2688, PRD omni-loop-3, PRD omni-loop-4)', () => {
    expect(appFunctions()).toEqual([]);
  });
});
