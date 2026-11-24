import { describe, expect, it } from 'vitest';
import { cannotRunFix } from './cannot-run-fix';

const job = { repo: 'acme/widgets' };
const runners = [{ id: 'a', repos: ['acme/other'] }, { id: 'b', repos: ['acme/widgets'] }];
const owner = { owner: true };
const member = { owner: false };

describe('cannotRunFix', () => {
  it('AC-6: offers to copy the runner command when no runner holds the repository, or the runner sent to does not', () => {
    const copy = { kind: 'copy', label: 'Copy runner command', command: 'omni runner --name <name> --repos <dir>' };
    expect(cannotRunFix(job, 'No runner holds acme/widgets', runners, member)).toEqual(copy);
    expect(cannotRunFix(job, 'ada does not hold acme/widgets', runners, member)).toEqual(copy);
  });

  it('AC-6: offers to copy omni update for an old kit', () => {
    expect(cannotRunFix(job, "Update the runner's kit", runners, member)).toEqual({ kind: 'copy', label: 'Copy omni update', command: 'omni update' });
  });

  it('offers a workspace owner to show the fleet of the first runner holding the repository, and anyone else nothing', () => {
    expect(cannotRunFix(job, 'No runner of Comets holds acme/widgets', runners, owner)).toEqual({ kind: 'fleet', runner: 'b' });
    expect(cannotRunFix(job, 'No runner of Comets holds acme/widgets', runners, member)).toBeNull();
    expect(cannotRunFix(job, 'No runner of Comets holds acme/widgets', [], owner)).toBeNull();
  });

  it('offers to send to any runner when the runner or the fleet is gone', () => {
    expect(cannotRunFix(job, 'The runner it was sent to is gone', runners, member)).toEqual({ kind: 'any' });
    expect(cannotRunFix(job, 'Fleet nebula is gone', runners, member)).toEqual({ kind: 'any' });
  });

  it('offers nothing for a job that can run', () => {
    expect(cannotRunFix(job, null, runners, owner)).toBeNull();
  });
});
