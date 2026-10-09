import { useState } from 'react';
import {
  addableOf, APPROVER_STATES, approveRuleOf, ApproverState, memberLabel, type Approver, type ApproversForm, type Member,
} from './approvers';

// A product's Approvers list drawn (PRD 1322 s1, acceptance 1): each listed member with their state,
// asked to approve or skipped. A workspace owner picks each state, removes a member and adds one of the
// others (asked to approve, at first); any other member reads the same list as text. Below it, the rule
// the list sets on approving. Drawn on the server first; ProductPage.tsx wires it.

export const APPROVERS_HINT = 'Who approves this product’s PRDs born on the server. Those asked to approve are told when one waits for them; skipped members never are.';
export const APPROVERS_READ_ONLY = 'Only a workspace owner changes this list.';
export const APPROVERS_UNREADABLE = 'Couldn’t load this product’s approvers. Reload in a moment.';
export const NO_APPROVERS = 'Nobody is listed yet.';

export interface ApproversHandlers {
  set: (member: string, state: ApproverState) => void;
  remove: (member: string) => void;
}

const IDLE: ApproversHandlers = { set: () => {}, remove: () => {} };

const stateLabel = (state: ApproverState): string => APPROVER_STATES.find((s) => s.value === state)?.label ?? state;

function OwnedRow({ approver, busy, on }: { approver: Approver; busy: boolean; on: ApproversHandlers }) {
  const label = memberLabel(approver);
  return (
    <li className="approvers-row">
      <strong>{label}</strong>
      <select
        className="products-look-select"
        aria-label={label}
        value={approver.state}
        disabled={busy}
        onChange={(e) => {
          const state = ApproverState.safeParse(e.currentTarget.value);
          if (state.success) on.set(approver.id, state.data);
        }}
      >
        {APPROVER_STATES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
      </select>
      <button className="ask-button quiet" type="button" disabled={busy} onClick={() => { on.remove(approver.id); }}>Remove</button>
    </li>
  );
}

function AddMember({ addable, busy, on }: { addable: Member[]; busy: boolean; on: ApproversHandlers }) {
  const [picked, setPicked] = useState('');
  const member = addable.find((m) => m.id === picked) ?? addable[0];
  if (!member) return null;
  return (
    <form className="approvers-add" onSubmit={(e) => { e.preventDefault(); on.set(member.id, 'asked'); }}>
      <select className="products-look-select" aria-label="Member to add" value={member.id} disabled={busy} onChange={(e) => { setPicked(e.currentTarget.value); }}>
        {addable.map((m) => <option key={m.id} value={m.id}>{memberLabel(m)}</option>)}
      </select>
      <button className="ask-button" type="submit" disabled={busy}>Add</button>
    </form>
  );
}

function ReadRow({ approver }: { approver: Approver }) {
  return (
    <li className="approvers-row">
      <strong>{memberLabel(approver)}</strong>
      <span className="ask-muted">{stateLabel(approver.state)}</span>
    </li>
  );
}

export function ApproversSection({ form, on = IDLE }: { form: ApproversForm | null; on?: ApproversHandlers }) {
  return (
    <section className="ask-card products-section" aria-labelledby="approvers-title">
      <h2 id="approvers-title">Approvers</h2>
      <p className="ask-muted">{APPROVERS_HINT}</p>
      {form ? <ApproversBody form={form} on={on} /> : <p className="products-refusal" role="alert">{APPROVERS_UNREADABLE}</p>}
    </section>
  );
}

function ApproversBody({ form, on }: { form: ApproversForm; on: ApproversHandlers }) {
  const { approvers, busy, message } = form;
  return (
    <>
      {approvers.listed.length === 0
        ? <p className="products-empty">{NO_APPROVERS}</p>
        : (
          <ul className="approvers-list">
            {approvers.listed.map((a) => (approvers.owner
              ? <OwnedRow key={a.id} approver={a} busy={busy} on={on} />
              : <ReadRow key={a.id} approver={a} />))}
          </ul>
        )}
      {approvers.owner ? <AddMember addable={addableOf(approvers)} busy={busy} on={on} /> : <p className="ask-muted">{APPROVERS_READ_ONLY}</p>}
      <p className="pitch-notice">{approveRuleOf(approvers.listed)}</p>
      {message ? <p className="products-refusal" role="alert">{message}</p> : null}
    </>
  );
}
