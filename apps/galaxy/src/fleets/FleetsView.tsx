import type { SubmitEvent } from 'react';
import type { FleetRow } from '../arcade/types';
import { FleetCard, mascotSvg } from './FleetCard';
import { activeFleets, previewOf, retiredFleets, SWATCHES, type Draft, type DraftField, type FleetsState } from './model';
import type { Refusal } from './refusal';

// /app/settings/fleets drawn from its state (PRD 400 s3). The owner reads New fleet, the form (label, colour
// swatches or a hex, motto, a mascot or none) with a live card preview, Edit and Retire on each active
// fleet (Retire confirmed on the page), and the retired fleets under a fold with Restore. A member
// reads the same cards, read-only, and who may change them. A refusal from the fleet functions is
// shown next to its field; the fleet cap by the list; anything else on the form, or above the list
// when no form is open. Drawn on the server first; FleetsPage.tsx wires the handlers.

/** What a member reads instead of the controls. */
export const ONLY_OWNER = 'Only @owner can change fleets.';

const LIMITS = { label: 12, motto: 60 } as const;
const MAX_ACTIVE = 12;

export interface FleetsHandlers {
  create: () => void;
  edit: (name: string) => void;
  change: (field: DraftField, value: string) => void;
  cancel: () => void;
  save: () => void;
  askRetire: (name: string) => void;
  keep: () => void;
  retire: (name: string) => void;
  restore: (name: string) => void;
}

const IDLE: FleetsHandlers = { create() {}, edit() {}, change() {}, cancel() {}, save() {}, askRetire() {}, keep() {}, retire() {}, restore() {} };

export interface FleetsViewProps {
  state: FleetsState;
  owner: boolean;
  /** The mascot keys the owner may pick (fleet_mascots()). */
  mascots: readonly string[];
  on?: FleetsHandlers;
}

function Refused({ refusal, at }: { refusal: Refusal | null; at: Refusal['field'] }) {
  if (!refusal || refusal.field !== at) return null;
  return <p className="fleets-refusal" role="alert" id={`fleets-refusal-${at}`}>{refusal.message}</p>;
}

/** The input's attributes when its field was refused. */
const invalid = (refusal: Refusal | null, at: DraftField) =>
  refusal?.field === at ? { 'aria-invalid': true as const, 'aria-describedby': `fleets-refusal-${at}` } : {};

function FleetForm({ draft, refusal, busy, mascots, on }: { draft: Draft; refusal: Refusal | null; busy: boolean; mascots: readonly string[]; on: FleetsHandlers }) {
  const submit = (e: SubmitEvent<HTMLFormElement>) => { e.preventDefault(); on.save(); };
  const color = draft.color.trim().toLowerCase();
  const preview = previewOf(draft);
  return (
    <form className="ask-card fleets-form" onSubmit={submit} aria-labelledby="fleets-form-title">
      <h2 id="fleets-form-title">{draft.name ? `Edit ${draft.label || draft.name}` : 'New fleet'}</h2>
      <Refused refusal={refusal} at="form" />

      <div className="fleets-field" data-field="label">
        <label htmlFor="fleets-label">Label</label>
        <input id="fleets-label" name="label" type="text" autoComplete="off" value={draft.label}
          onChange={(e) => { on.change('label', e.target.value); }} {...invalid(refusal, 'label')} />
        <span className="fleets-count" aria-hidden="true">{draft.label.trim().length}/{LIMITS.label}</span>
        <Refused refusal={refusal} at="label" />
      </div>

      <div className="fleets-field" data-field="color">
        <fieldset>
          <legend>Colour</legend>
          <div className="fleets-swatches">
            {SWATCHES.map((s) => (
              <button key={s} type="button" className="fleets-swatch" data-swatch={s} style={{ background: s }}
                aria-label={s} aria-pressed={color === s} onClick={() => { on.change('color', s); }} />
            ))}
          </div>
          <label htmlFor="fleets-color">Hex</label>
          <input id="fleets-color" name="color" type="text" autoComplete="off" spellCheck={false} value={draft.color}
            onChange={(e) => { on.change('color', e.target.value); }} {...invalid(refusal, 'color')} />
        </fieldset>
        <Refused refusal={refusal} at="color" />
      </div>

      <div className="fleets-field" data-field="motto">
        <label htmlFor="fleets-motto">Motto</label>
        <input id="fleets-motto" name="motto" type="text" autoComplete="off" value={draft.motto}
          onChange={(e) => { on.change('motto', e.target.value); }} {...invalid(refusal, 'motto')} />
        <span className="fleets-count" aria-hidden="true">{draft.motto.trim().length}/{LIMITS.motto}</span>
        <Refused refusal={refusal} at="motto" />
      </div>

      <div className="fleets-field" data-field="mascot">
        <fieldset {...invalid(refusal, 'mascot')}>
          <legend>Mascot</legend>
          <div className="fleets-mascots">
            <label className="fleets-mascot">
              <input type="radio" name="mascot" value="" checked={draft.mascot === null} onChange={() => { on.change('mascot', ''); }} />
              <span dangerouslySetInnerHTML={{ __html: mascotSvg(null, preview.color, 'A hero in the fleet’s colour') }} />
              <span>None</span>
            </label>
            {mascots.map((m) => (
              <label key={m} className="fleets-mascot">
                <input type="radio" name="mascot" value={m} checked={draft.mascot === m} onChange={() => { on.change('mascot', m); }} />
                <span dangerouslySetInnerHTML={{ __html: mascotSvg(m, preview.color, m) }} />
                <span>{m}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <Refused refusal={refusal} at="mascot" />
      </div>

      <div className="fleets-preview" aria-label="Preview">
        <p className="ask-muted">Preview</p>
        <FleetCard fleet={preview} />
      </div>

      <div className="fleets-actions">
        <button type="submit" className="ask-button" disabled={busy}>{draft.name ? 'Save changes' : 'Create fleet'}</button>
        <button type="button" className="ask-button quiet" onClick={on.cancel} disabled={busy}>Cancel</button>
      </div>
    </form>
  );
}

function ActiveFleet({ fleet, state, owner, on }: { fleet: FleetRow; state: FleetsState; owner: boolean; on: FleetsHandlers }) {
  const asking = owner && state.confirming === fleet.name;
  return (
    <li>
      <FleetCard fleet={fleet}>
        {owner && !asking && (
          <div className="fleets-card-actions">
            <button type="button" className="ask-button quiet" onClick={() => { on.edit(fleet.name); }} disabled={state.busy}>Edit</button>
            <button type="button" className="ask-button quiet" onClick={() => { on.askRetire(fleet.name); }} disabled={state.busy}>Retire</button>
          </div>
        )}
      </FleetCard>
      {asking && (
        <div className="fleets-confirm" role="group" aria-label={`Retire ${fleet.label}?`}>
          <p><b>Retire {fleet.label}?</b> It leaves the arcade’s fleet step. Its players and its history keep its look, and you can restore it.</p>
          <button type="button" className="ask-button" onClick={() => { on.retire(fleet.name); }} disabled={state.busy}>Retire {fleet.label}</button>
          <button type="button" className="ask-button quiet" onClick={on.keep} disabled={state.busy}>Keep it</button>
        </div>
      )}
    </li>
  );
}

export function FleetsView({ state, owner, mascots, on = IDLE }: FleetsViewProps) {
  const active = activeFleets(state);
  const retired = retiredFleets(state);
  const draft = owner ? state.draft : null;
  return (
    <div className="ask-col fleets">
      <section className="ask-card fleets-head" aria-labelledby="fleets-title">
        <h1 id="fleets-title">Fleets</h1>
        {owner
          ? <p className="ask-muted">Your workspace’s fleets. Players pick one on the arcade’s fleet step, or play solo.</p>
          : <p className="ask-muted">{ONLY_OWNER}</p>}
        {owner && !draft && <Refused refusal={state.refusal} at="form" />}
        {owner && !draft && <button type="button" className="ask-button" onClick={on.create} disabled={state.busy}>New fleet</button>}
      </section>

      {draft && <FleetForm draft={draft} refusal={state.refusal} busy={state.busy} mascots={mascots} on={on} />}

      <section className="fleets-active" aria-label="Active fleets">
        <p className="ask-muted">{active.length} of {MAX_ACTIVE} active</p>
        {owner && <Refused refusal={state.refusal} at="fleets" />}
        {active.length === 0
          ? <p className="fleets-empty">No fleets yet. {owner ? 'Raise the first one: players pick it on the arcade’s fleet step.' : 'Until one is raised, everyone plays solo.'}</p>
          : <ul className="fleets-list">{active.map((f) => <ActiveFleet key={f.name} fleet={f} state={state} owner={owner} on={on} />)}</ul>}
      </section>

      {retired.length > 0 && (
        <details className="fleets-retired">
          <summary>Retired fleets · {retired.length}</summary>
          <ul className="fleets-list">
            {retired.map((f) => (
              <li key={f.name}>
                <FleetCard fleet={f}>
                  {owner && (
                    <div className="fleets-card-actions">
                      <button type="button" className="ask-button quiet" onClick={() => { on.restore(f.name); }} disabled={state.busy}>Restore</button>
                    </div>
                  )}
                </FleetCard>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
