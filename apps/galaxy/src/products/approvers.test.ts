import { describe, expect, it } from 'vitest';
import {
  addableOf, approversOf, approversReducer, approveRuleOf, initialApproversForm,
  NOT_OWNER, NOBODY_ASKED, ONLY_ASKED, type Approvers, type Member,
} from './approvers';

// A product's Approvers list (PRD 1322 s1) as data: the workspace's members, each listed asked to
// approve or skipped, or not listed; who may still be added; the rule the list sets on approving; the
// page's state as an owner edits it. The calls are the product home's Repositories & approvers tab's
// (PRD 1364 s11, src/product-repositories/repositories-tab.*.test.ts).

const IRISA: Member = { id: 'u-irisa', name: 'Irisa', login: 'irisa' };
const PAUL: Member = { id: 'u-paul', name: null, login: 'paul' };
const DEV: Member = { id: 'u-dev', name: 'Dev', login: null };

const LISTED: Approvers = {
  owner: true,
  members: [IRISA, PAUL, DEV],
  listed: [{ ...IRISA, state: 'asked' }, { ...DEV, state: 'skipped' }],
};

describe('the list', () => {
  it('lists the stored rows in the members\' order, by name, and drops a row whose member left', () => {
    const rows = [{ user_id: 'u-dev', state: 'skipped' as const }, { user_id: 'u-irisa', state: 'asked' as const }, { user_id: 'u-gone', state: 'asked' as const }];
    expect(approversOf([IRISA, PAUL, DEV], rows)).toEqual([{ ...IRISA, state: 'asked' }, { ...DEV, state: 'skipped' }]);
  });

  it('offers to add only the members not listed yet', () => {
    expect(addableOf(LISTED)).toEqual([PAUL]);
  });

  it('says who may approve: only the asked once anyone is, any member before', () => {
    expect(approveRuleOf(LISTED.listed)).toBe(ONLY_ASKED);
    expect(approveRuleOf([{ ...DEV, state: 'skipped' }])).toBe(NOBODY_ASKED);
    expect(approveRuleOf([])).toBe(NOBODY_ASKED);
  });
});

describe('the page\'s state', () => {
  it('adds a member, changes a state in place, and removes one', () => {
    let state = initialApproversForm(LISTED);
    state = approversReducer(state, { type: 'busy' });
    expect(state.busy).toBe(true);
    state = approversReducer(state, { type: 'set', member: PAUL.id, state: 'asked' });
    expect(state.busy).toBe(false);
    expect(state.approvers.listed.map((a) => [a.login ?? a.name, a.state])).toEqual([['irisa', 'asked'], ['paul', 'asked'], ['Dev', 'skipped']]);
    state = approversReducer(state, { type: 'set', member: IRISA.id, state: 'skipped' });
    expect(state.approvers.listed.find((a) => a.id === IRISA.id)?.state).toBe('skipped');
    state = approversReducer(state, { type: 'removed', member: DEV.id });
    expect(state.approvers.listed.map((a) => a.id)).toEqual([IRISA.id, PAUL.id]);
  });

  it('keeps the list and says why when a change is refused, until the next change', () => {
    let state = approversReducer(initialApproversForm(LISTED), { type: 'refused', message: NOT_OWNER });
    expect(state).toMatchObject({ busy: false, message: NOT_OWNER, approvers: LISTED });
    state = approversReducer(state, { type: 'removed', member: DEV.id });
    expect(state.message).toBeNull();
  });
});
