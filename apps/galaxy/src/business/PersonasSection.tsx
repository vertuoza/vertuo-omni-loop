import type { SubmitEvent } from 'react';
import { PERSONA_TRADES, personaGrid, TRADE_MAX, validPersonaTrade, type PersonaAvatar } from '@omni/design';
import { pixelSvg } from '../design/pixel-svg';
import { defined } from 'omni-loop/kit/lib/narrow.ts';
import { hasProducts, type Product } from './model';
import {
  NAME_MAX, PICKER_SIZE, pickerOf, portraitTrade, sameAvatar, STANCES, TEXT_MAX, tradeLabel, tradeProblem, viewPersonas,
  type Persona, type PersonaFields, type PersonasState, type Stance,
} from './personas';

// Settings → Business → Personas drawn from its state (PRD 799 s3, direction A: the card grid). Below
// the business sentence and its claims: a header with the count and + Add a persona, then one card per
// persona (portrait, name, trade, stance chip, then who and uses), or "No personas yet — agents carry
// on". With two products or more, the cast is the tab's; with one, no text says "product" (PRD 748).
//
// The drawer adds or edits one persona: the name, the stance (three chips), the trade (a select), who,
// usage, and the portrait picker, 24 variations of the trade with Shuffle for 24 others, the chosen one
// outlined. Delete removes it at once; the Undo line stays for 5 seconds. Portraits are drawn as SVG
// from @omni/design's personaGrid(), on the server first; BusinessPage.tsx wires the handlers.

export interface PersonaHandlers {
  /** + Add a persona. */
  open: () => void;
  edit: (persona: Persona) => void;
  change: (fields: Partial<PersonaFields>, other?: boolean) => void;
  shuffle: () => void;
  close: () => void;
  save: () => void;
  remove: () => void;
  undo: () => void;
}

const IDLE: PersonaHandlers = { open() {}, edit() {}, change() {}, shuffle() {}, close() {}, save() {}, remove() {}, undo() {} };

const PERSONAS_TITLE = 'Personas';
export const ADD_PERSONA = '+ Add a persona';
export const NO_PERSONAS = 'No personas yet — agents carry on';
const PERSONAS_HINT = 'Who agents picture when they design. Describe a kind of customer, never a real one by name.';
export const SHUFFLE = '⟳ Shuffle';
export const UNDO = 'Undo';
const STANCE_LABEL: Readonly<Record<Stance, string>> = { enthusiastic: 'Enthusiastic', neutral: 'Neutral', skeptical: 'Skeptical' };

export interface PersonasSectionProps {
  state: PersonasState;
  products: readonly Product[];
  /** The product whose tab is shown. */
  current: string | null;
  on?: PersonaHandlers;
}

const Portrait = ({ trade, avatar, scale, title }: { trade: string; avatar: PersonaAvatar; scale: number; title: string }) =>
  <span className="business-portrait" dangerouslySetInnerHTML={{ __html: pixelSvg(personaGrid(portraitTrade(trade), avatar), { scale, title }) }} />;

/** The select's value for Other…: a trade id is lower-case, so no listed one can be it. */
const OTHER_VALUE = 'Other…';
/** What a trade is called while an Other trade is still empty. */
const OTHER_LABEL = 'Other trade';
const labelOf = (trade: string) => tradeLabel(trade) || OTHER_LABEL;

function StanceChip({ stance }: { stance: Stance }) {
  return <span className="business-stance" data-stance={stance}>{STANCE_LABEL[stance]}</span>;
}

/** One persona's card, and the drawer that edits or adds one: the Knowledge home's pages draw them alone (PRD 2240 s4). */
export function Card({ persona, busy, on }: { persona: Persona; busy: boolean; on: PersonaHandlers }) {
  return (
    <li className="business-persona" data-persona={persona.id}>
      <div className="business-persona-top">
        <Portrait trade={persona.trade} avatar={persona.avatar} scale={2} title={`${persona.name}, ${tradeLabel(persona.trade)}`} />
        <div className="business-persona-id">
          <strong className="business-persona-name">{persona.name}</strong>
          <span className="business-persona-trade">{tradeLabel(persona.trade)}</span>
          <StanceChip stance={persona.stance} />
        </div>
      </div>
      {persona.who && <p className="business-persona-line"><span className="business-persona-label">Who</span> {persona.who}</p>}
      {persona.usage && <p className="business-persona-line"><span className="business-persona-label">Uses</span> {persona.usage}</p>}
      <button type="button" className="ask-button quiet business-persona-edit" aria-label={`Edit ${persona.name}`} onClick={() => { on.edit(persona); }} disabled={busy}>Edit</button>
    </li>
  );
}

function Picker({ state, on }: { state: PersonasState; on: PersonaHandlers }) {
  const drawer = defined(state.drawer, 'the open drawer');
  const { trade, avatar } = drawer.fields;
  const label = labelOf(trade);
  return (
    <div className="business-persona-picker" role="group" aria-labelledby="business-persona-portrait">
      <div className="business-persona-picker-head">
        <span id="business-persona-portrait" className="business-type-label">Portrait</span>
        <button type="button" className="ask-button quiet" onClick={on.shuffle} disabled={state.busy}>{SHUFFLE}</button>
      </div>
      <div className="business-persona-variations">
        {pickerOf(drawer).map((a, i) => {
          const chosen = sameAvatar(a, avatar);
          return (
            <button
              key={`${drawer.page}-${i}`}
              type="button"
              className="business-persona-variation"
              aria-pressed={chosen}
              aria-label={`${label}, variation ${drawer.page * PICKER_SIZE + i + 1}`}
              onClick={() => { on.change({ avatar: a }); }}
              disabled={state.busy}
            >
              <Portrait trade={trade} avatar={a} scale={1} title={`${label}, variation ${drawer.page * PICKER_SIZE + i + 1}`} />
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** The trade: the list, then Other… and its text field with the live check of the trade rule. */
function TradeFields({ state, on }: { state: PersonasState; on: PersonaHandlers }) {
  const drawer = defined(state.drawer, 'the open drawer');
  const f = drawer.fields;
  return (
    <>
      <label className="business-persona-field">
        <span className="business-type-label">Trade</span>
        <select
          name="trade"
          value={drawer.other ? OTHER_VALUE : f.trade}
          disabled={state.busy}
          onChange={(e) => {
            const picked = e.currentTarget.value;
            if (picked === OTHER_VALUE) on.change({ trade: '' }, true);
            else on.change({ trade: picked }, false);
          }}
        >
          {PERSONA_TRADES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
          <option value={OTHER_VALUE}>{OTHER_VALUE}</option>
        </select>
      </label>
      {drawer.other && (
        <label className="business-persona-field">
          <span className="business-type-label">Other trade</span>
          <input
            name="other-trade" type="text" value={f.trade} maxLength={TRADE_MAX} required autoComplete="off" disabled={state.busy}
            aria-invalid={tradeProblem(f.trade) !== null} aria-describedby={tradeProblem(f.trade) ? 'business-other-trade-rule' : undefined}
            onChange={(e) => { on.change({ trade: e.currentTarget.value }); }}
          />
          {tradeProblem(f.trade) && <span id="business-other-trade-rule" className="business-refusal" role="alert">{tradeProblem(f.trade)}</span>}
        </label>
      )}
    </>
  );
}

export function Drawer({ state, on }: { state: PersonasState; on: PersonaHandlers }) {
  const drawer = defined(state.drawer, 'the open drawer');
  const f = drawer.fields;
  const editing = drawer.editing !== null;
  const title = editing ? `Edit ${f.name.trim() || 'persona'}` : 'Add a persona';
  const submit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!validPersonaTrade(f.trade)) return;
    on.save();
  };
  return (
    <form className="business-persona-drawer" aria-label={title} onSubmit={submit}>
      <div className="business-persona-chosen">
        <Portrait trade={f.trade} avatar={f.avatar} scale={4} title={`${f.name.trim() || 'New persona'}, ${labelOf(f.trade)}`} />
      </div>
      <div className="business-persona-fields">
        <h3>{title}</h3>
        <label className="business-persona-field">
          <span className="business-type-label">Name</span>
          <input name="name" type="text" value={f.name} maxLength={NAME_MAX} required autoComplete="off" disabled={state.busy} onChange={(e) => { on.change({ name: e.currentTarget.value }); }} />
        </label>
        <div className="business-persona-field" role="group" aria-labelledby="business-persona-stance">
          <span id="business-persona-stance" className="business-type-label">Stance</span>
          <div className="business-chips">
            {STANCES.map((s) => (
              <button key={s} type="button" className="business-chip" data-stance={s} aria-pressed={f.stance === s} onClick={() => { on.change({ stance: s }); }} disabled={state.busy}>
                {STANCE_LABEL[s]}
              </button>
            ))}
          </div>
        </div>
        <TradeFields state={state} on={on} />
        <label className="business-persona-field">
          <span className="business-type-label">Who they are</span>
          <textarea name="who" rows={3} value={f.who} maxLength={TEXT_MAX} disabled={state.busy} onChange={(e) => { on.change({ who: e.currentTarget.value }); }} />
        </label>
        <label className="business-persona-field">
          <span className="business-type-label">How they use it</span>
          <textarea name="usage" rows={2} value={f.usage} maxLength={TEXT_MAX} disabled={state.busy} onChange={(e) => { on.change({ usage: e.currentTarget.value }); }} />
        </label>
        <Picker state={state} on={on} />
        {state.refusal && <p className="business-refusal" role="alert">{state.refusal}</p>}
        <div className="business-persona-actions">
          <button type="submit" className="ask-button" disabled={state.busy}>Save</button>
          <button type="button" className="ask-button quiet" onClick={on.close} disabled={state.busy}>Cancel</button>
          {editing && <button type="button" className="ask-button quiet business-persona-delete" onClick={on.remove} disabled={state.busy}>Delete</button>}
        </div>
      </div>
    </form>
  );
}

export function PersonasSection({ state, products, current, on = IDLE }: PersonasSectionProps) {
  const cast = viewPersonas(state.personas, products, current);
  const product = hasProducts(products) ? products.find((p) => p.id === current)?.name : undefined;
  return (
    <section className="ask-card business-personas" aria-labelledby="business-personas-title">
      <div className="business-personas-head">
        <h2 id="business-personas-title">{PERSONAS_TITLE}{product ? ` · ${product}` : ''}</h2>
        <span className="ask-chip">{cast.length}</span>
        {!state.drawer && (
          <button type="button" className="ask-button quiet business-add-persona" onClick={on.open} disabled={state.busy}>{ADD_PERSONA}</button>
        )}
      </div>
      <p className="ask-muted business-personas-hint">{PERSONAS_HINT}</p>
      {state.undo && (
        <p className="business-personas-undo" role="status">
          <span>Deleted {state.undo.persona.name}.</span>
          <button type="button" className="ask-button quiet" onClick={on.undo} disabled={state.busy}>{UNDO}</button>
        </p>
      )}
      {!state.drawer && state.refusal && <p className="business-refusal" role="alert">{state.refusal}</p>}
      {state.drawer && <Drawer state={state} on={on} />}
      {cast.length === 0
        ? <p className="business-personas-empty">{NO_PERSONAS}</p>
        : <ul className="business-persona-grid">{cast.map((p) => <Card key={p.id} persona={p} busy={state.busy} on={on} />)}</ul>}
    </section>
  );
}
