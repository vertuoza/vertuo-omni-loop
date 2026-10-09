import { describe, expect, it } from 'vitest';
import {
  addableOf, approversOf, approversReducer, approveRuleOf, COULD_NOT_SAVE, databaseApprovers, demoApprovers, GONE, initialApproversForm,
  NOT_OWNER, NOT_MEMBER, NOBODY_ASKED, ONLY_ASKED, type Approvers, type Member,
} from './approvers';

// A product's Approvers list (PRD 1322 s1) as data: the workspace's members, each listed asked to
// approve or skipped, or not listed; who may still be added; the rule the list sets on approving; the
// page's state as an owner edits it; and the calls, product_approver_set() and product_approver_remove()
// as the signed-in person, or the same rules in memory for the demo.

const IRISA: Member = { id: 'u-irisa', name: 'Irisa', login: 'irisa' };
const PAUL: Member = { id: 'u-paul', name: null, login: 'paul' };
const DEV: Member = { id: 'u-dev', name: 'Dev', login: null };

const LISTED: Approvers = {
  owner: true,
  members: [IRISA, PAUL, DEV],
  listed: [{ ...IRISA, state: 'asked' }, { ...DEV, state: 'skipped' }],
};

function db(answer: { data?: unknown; error?: unknown } | Error) {
  const calls: [string, unknown][] = [];
  return {
    calls,
    rpc: (fn: string, args: Record<string, unknown>) => {
      calls.push([fn, args]);
      if (answer instanceof Error) return Promise.reject(answer);
      return Promise.resolve({ data: answer.data ?? null, error: answer.error ?? null });
    },
  };
}

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

describe('the database calls', () => {
  it('lists a member with product_approver_set(), answering the state it stored', async () => {
    const d = db({ data: { product: 'p-1', member: 'u-paul', state: 'asked' } });
    expect(await databaseApprovers(d, 'p-1').set('u-paul', 'asked')).toEqual({ ok: true, state: 'asked' });
    expect(d.calls).toEqual([['product_approver_set', { p_product: 'p-1', p_member: 'u-paul', p_state: 'asked' }]]);
  });

  it('takes a member off with product_approver_remove()', async () => {
    const d = db({ data: true });
    expect(await databaseApprovers(d, 'p-1').remove('u-dev')).toEqual({ ok: true });
    expect(d.calls).toEqual([['product_approver_remove', { p_product: 'p-1', p_member: 'u-dev' }]]);
  });

  it('says why a change was refused, and keeps going when the call throws or answers out of shape', async () => {
    expect(await databaseApprovers(db({ error: { code: '42501' } }), 'p-1').set('u-paul', 'asked')).toEqual({ ok: false, message: NOT_OWNER });
    expect(await databaseApprovers(db({ error: { code: '22023' } }), 'p-1').set('u-paul', 'asked')).toEqual({ ok: false, message: NOT_MEMBER });
    expect(await databaseApprovers(db({ error: { code: 'P0002' } }), 'p-1').remove('u-paul')).toEqual({ ok: false, message: GONE });
    expect(await databaseApprovers(db(new Error('offline')), 'p-1').remove('u-paul')).toEqual({ ok: false, message: COULD_NOT_SAVE });
    expect(await databaseApprovers(db({ data: { state: 'maybe' } }), 'p-1').set('u-paul', 'asked')).toEqual({ ok: false, message: COULD_NOT_SAVE });
    expect(await databaseApprovers(db({ data: 'yes' }), 'p-1').remove('u-paul')).toEqual({ ok: false, message: COULD_NOT_SAVE });
  });
});

describe('the demo', () => {
  it('keeps the same rules in memory: a workspace member only', async () => {
    const demo = demoApprovers([IRISA, PAUL]);
    expect(await demo.set('u-paul', 'skipped')).toEqual({ ok: true, state: 'skipped' });
    expect(await demo.set('u-stranger', 'asked')).toEqual({ ok: false, message: NOT_MEMBER });
    expect(await demo.remove('u-paul')).toEqual({ ok: true });
  });
});
