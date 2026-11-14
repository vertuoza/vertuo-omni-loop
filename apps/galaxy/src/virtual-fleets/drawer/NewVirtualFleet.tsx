'use client';
import { useEffect, useId, useMemo, useReducer, useRef, useState, type KeyboardEvent, type RefObject } from 'react';
import { useRouter } from 'next/navigation';
import { HERO_ROLES } from 'omni-loop/kit/lib/virtual-fleet/roles.ts';
import { mascotSvg } from '../../fleets/FleetCard';
import { NEUTRAL } from '../../fleets/model';
import { decorative } from '../../people/face';
import { drawerMove } from '../../runners/page/need-human';
import { httpVirtualFleetsPort, type VirtualFleetsPort } from '../virtual-fleets.client';
import { FLEET_NAME_MAX } from '../virtual-fleets.contract';
import {
  canCreate, demoPort, landingOf, newFleetReducer, openedWith, refusalUnder, requestOf, roleSwitch, WORDS, type NewFleetAction, type NewFleetState,
} from './new-fleet';
import '../../runners/page/need-human.css';
import './new-fleet.css';

// The New virtual fleet drawer (PRD 2842 s1, the `fleet-new` screen): `+ New virtual fleet` in the Fleet
// section opens it over the right of the page, the page behind dimmed, the whole width under 720 px, as
// the Runners page's Need human drawer opens. Name first and focused, then Icon (the fleet mascots, the
// first selected), then Heroes (the five roles, each a yes/no switch, all on, each with one line on
// whether it works alone today), and the foot, Cancel and Create fleet. Create fleet makes the fleet and
// lands on it; a refusal is shown under its field, or in the foot. Tab stays inside it, and Escape,
// Cancel, the close button or the dimmed page close it and give the focus back to the button. It wears
// the Need human drawer's own frame (src/runners/page/need-human.css); ./new-fleet.css adds its fields.
// The rules live in ./new-fleet.ts; this file draws them.

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled])';

export interface NewVirtualFleetProps {
  /** The workspace the fleet is made in; null in the demo, whose port makes none. */
  workspace: string | null;
  /** The fleet mascots, in the library's order. */
  mascots: readonly string[];
  /** The page's main button: the workspace has no fleet yet. */
  primary?: boolean;
}

/** The button, and the drawer it opens. */
export function NewVirtualFleet({ workspace, mascots, primary = false }: NewVirtualFleetProps) {
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement | null>(null);
  const port = useMemo(() => (workspace === null ? demoPort : httpVirtualFleetsPort(workspace)), [workspace]);
  const close = () => {
    setOpen(false);
    button.current?.focus();
  };
  return (
    <>
      <button type="button" ref={button} className={primary ? 'ask-button vf-open' : 'ask-button quiet vf-open'} {...(primary ? { 'data-primary': '' } : {})} onClick={() => { setOpen(true); }}>
        {WORDS.open}
      </button>
      {open && <NewFleetDrawer mascots={mascots} port={port} onClose={close} />}
    </>
  );
}

/** The drawer, live: its state, its call, its keys and its focus. */
function NewFleetDrawer({ mascots, port, onClose }: { mascots: readonly string[]; port: VirtualFleetsPort; onClose: () => void }) {
  const router = useRouter();
  const [state, dispatch] = useReducer(newFleetReducer, mascots, openedWith);
  const panel = useRef<HTMLElement | null>(null);
  const name = useRef<HTMLInputElement | null>(null);

  useEffect(() => { name.current?.focus(); }, []);

  async function create() {
    if (!canCreate(state)) return;
    dispatch({ type: 'busy' });
    const made = await port.create(requestOf(state));
    if (!made.ok) {
      dispatch({ type: 'refused', field: made.field, message: made.message });
      return;
    }
    router.push(landingOf(made.fleet.name));
    router.refresh();
  }

  // Tab stays inside the drawer and Escape closes it, as in the Need human drawer: the focus is always inside it.
  const onKey = (event: KeyboardEvent<HTMLElement>) => {
    const items = [...event.currentTarget.querySelectorAll<HTMLElement>(FOCUSABLE)];
    const move = drawerMove(event.key, event.shiftKey, items, document.activeElement);
    if (move.kind === 'close') {
      event.preventDefault();
      onClose();
    } else if (move.kind === 'focus') {
      event.preventDefault();
      move.item.focus();
    }
  };

  return <NewFleetView state={state} mascots={mascots} panel={panel} name={name} dispatch={dispatch} onClose={onClose} onCreate={() => { void create(); }} onKey={onKey} />;
}

export interface NewFleetViewProps {
  state: NewFleetState;
  mascots: readonly string[];
  panel?: RefObject<HTMLElement | null>;
  name?: RefObject<HTMLInputElement | null>;
  dispatch?: (action: NewFleetAction) => void;
  onClose?: () => void;
  onCreate?: () => void;
  onKey?: (event: KeyboardEvent<HTMLElement>) => void;
}

/** A refusal under a field, tied to it by its id. */
function Refused({ id, message }: { id: string; message: string | null }) {
  return message === null ? null : <p className="vf-error" id={id} role="alert">{message}</p>;
}

/** The drawer as drawn: header, Name, Icon, Heroes and the foot. */
export function NewFleetView({ state, mascots, panel, name, dispatch = () => undefined, onClose, onCreate, onKey }: NewFleetViewProps) {
  const id = useId();
  const nameError = refusalUnder(state, 'name');
  const iconError = refusalUnder(state, 'mascot');
  const heroesError = refusalUnder(state, 'heroes');
  const formError = refusalUnder(state, 'form');
  return (
    <div className="need-over">
      <div className="need-scrim" aria-hidden="true" onClick={onClose} />
      <section className="need" data-screen="fleet-new" role="dialog" aria-modal="true" aria-labelledby={`${id}-title`} tabIndex={-1} ref={panel} onKeyDown={onKey}>
        <header className="need-head">
          <h2 className="need-title vf-title" id={`${id}-title`}>{WORDS.title}</h2>
          <button type="button" className="need-close" aria-label={WORDS.close} onClick={onClose}>×</button>
        </header>
        <form className="vf-body" onSubmit={(event) => { event.preventDefault(); onCreate?.(); }}>
          <div className="vf-fields">
            <div className="vf-field">
              <label className="vf-label" htmlFor={`${id}-name`}>{WORDS.name}</label>
              <input
                id={`${id}-name`} ref={name} className="vf-input" type="text" autoComplete="off" maxLength={FLEET_NAME_MAX}
                placeholder={WORDS.placeholder} value={state.name} aria-invalid={nameError !== null}
                {...(nameError === null ? {} : { 'aria-describedby': `${id}-name-error` })}
                onChange={(event) => { dispatch({ type: 'name', value: event.target.value }); }}
              />
              <Refused id={`${id}-name-error`} message={nameError} />
            </div>
            <fieldset className="vf-field">
              <legend className="vf-label">{WORDS.icon}</legend>
              <div className="vf-icons">
                {mascots.map((mascot) => (
                  <label className="vf-icon" key={mascot} title={mascot}>
                    <input type="radio" name={`${id}-icon`} value={mascot} checked={state.mascot === mascot} aria-label={mascot} onChange={() => { dispatch({ type: 'mascot', value: mascot }); }} />
                    <span aria-hidden="true" dangerouslySetInnerHTML={{ __html: decorative(mascotSvg(mascot, NEUTRAL, '', 1)) }} />
                  </label>
                ))}
              </div>
              <Refused id={`${id}-icon-error`} message={iconError} />
            </fieldset>
            <fieldset className="vf-field">
              <legend className="vf-label">{WORDS.heroes}</legend>
              <ul className="vf-roles">
                {HERO_ROLES.map(roleSwitch).map((role) => {
                  const on = state.roles.includes(role.role);
                  return (
                    <li className="vf-role" key={role.role}>
                      <span className="vf-role-text">
                        <span className="vf-role-name" id={`${id}-${role.role}`}>{role.name}</span>
                        <span className="vf-role-line">{role.line}</span>
                      </span>
                      <button
                        type="button" role="switch" className="vf-switch" aria-checked={on} aria-labelledby={`${id}-${role.role}`}
                        onClick={() => { dispatch({ type: 'toggle', role: role.role }); }}
                      />
                    </li>
                  );
                })}
              </ul>
              <Refused id={`${id}-heroes-error`} message={heroesError} />
            </fieldset>
          </div>
          <footer className="need-foot">
            {formError !== null && <p className="need-problem" role="alert">{formError}</p>}
            <button type="button" className="ask-button quiet" onClick={onClose}>{WORDS.cancel}</button>
            <button type="submit" className="ask-button" data-primary disabled={!canCreate(state)}>{state.busy ? WORDS.creating : WORDS.create}</button>
          </footer>
        </form>
      </section>
    </div>
  );
}
