'use client';
import { useEffect, useReducer, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { canUndo, initialPersonasState, personasReducer, type Persona, type PersonasAction, type PersonasState } from '../../business/personas';
import type { PersonaPort } from '../../business/personas-store';
import { ADD_PERSONA, Card, Drawer, type PersonaHandlers } from '../../business/PersonasSection';
import type { WriteSource } from '../constituents/knowledge-reader';
import { personaPortFor } from './persona-port';

// What changes on the Personas section, in the browser (PRD 2240 s4): a persona's page draws its card,
// whose Edit opens the drawer (Save, Cancel, Delete), and the list draws + Add a persona under it, which
// opens the same drawer. The state and the writes are Settings › Business's (../../business/personas.ts,
// personas-store.ts), as the signed-in person. Once a change is saved the page refreshes in place, so the
// server draws what is now true and the address, with its sort, stays; a deleted persona goes back to its
// list, where Undo is no longer offered. In the demo, the same rules run in memory.

/** The cast's state and handlers: `newProduct` is the product a new persona goes on. */
function useCast(source: WriteSource, personas: Persona[], newProduct: string, after: (action: PersonasAction) => void): [PersonasState, PersonaHandlers] {
  const [cast, act] = useReducer(personasReducer, personas, initialPersonasState);
  const port = useRef<PersonaPort | null>(null);
  const getPort = () => (port.current ??= personaPortFor(source, personas));
  // Undo goes once its 5 seconds have passed.
  const until = cast.undo?.until ?? null;
  useEffect(() => {
    if (until === null) return;
    const timer = setTimeout(() => { act({ type: 'tick', at: Date.now() }); }, Math.max(0, until - Date.now()));
    return () => { clearTimeout(timer); };
  }, [until]);
  const run = async (call: () => Promise<PersonasAction>) => {
    if (cast.busy) return;
    act({ type: 'busy' });
    const answer = await call();
    act(answer);
    after(answer);
  };
  const handlers: PersonaHandlers = {
    open: () => { act({ type: 'new', product: newProduct, seed: `${Date.now()}-${Math.random()}` }); },
    edit: (p) => { act({ type: 'edit', persona: p.id, seed: `${Date.now()}-${Math.random()}` }); },
    change: (fields) => { act({ type: 'change', fields }); },
    shuffle: () => { act({ type: 'shuffle' }); },
    close: () => { act({ type: 'close' }); },
    save: () => {
      const drawer = cast.drawer;
      if (!drawer) return;
      const { editing, product, fields } = drawer;
      if (editing === null && !product) return;
      void run(async () => {
        const saved = editing !== null ? await getPort().edit(editing, fields) : await getPort().add(product ?? newProduct, fields);
        return saved.ok ? { type: 'saved', persona: saved.persona } : { type: 'refused', message: saved.message };
      });
    },
    remove: () => {
      const editing = cast.drawer?.editing;
      if (!editing) return;
      void run(async () => {
        const removed = await getPort().remove(editing);
        return removed.ok ? { type: 'deleted', persona: removed.persona, at: Date.now() } : { type: 'refused', message: removed.message };
      });
    },
    undo: () => {
      if (!cast.undo || !canUndo(cast, Date.now())) return;
      const persona = cast.undo.persona.id;
      void run(async () => {
        const back = await getPort().restore(persona);
        return back.ok ? { type: 'restored', persona: back.persona } : { type: 'refused', message: back.message };
      });
    },
  };
  return [cast, handlers];
}

interface Props {
  source: WriteSource;
  product: string;
}

/** What a saved or deleted persona does to the page: a deleted one returns to the list, and either refreshes. */
const settledWith = (router: ReturnType<typeof useRouter>, backHref: string) => (action: PersonasAction) => {
  if (action.type === 'deleted') router.push(backHref);
  if (action.type === 'saved' || action.type === 'deleted') router.refresh();
};

/** One persona, read whole: its card, Edit opening the drawer. Delete returns to the list. */
export function PersonaPage({ source, product, persona, backHref }: Props & { persona: Persona; backHref: string }) {
  const [cast, on] = useCast(source, [persona], product, settledWith(useRouter(), backHref));
  if (cast.drawer) return <Drawer state={cast} on={on} />;
  return (
    <>
      {cast.refusal && <p className="business-refusal" role="alert">{cast.refusal}</p>}
      <ul className="business-persona-grid"><Card persona={cast.personas.find((p) => p.id === persona.id) ?? persona} busy={cast.busy} on={on} /></ul>
    </>
  );
}

/** + Add a persona under the list, and the drawer it opens. */
export function AddPersona({ source, product, personas }: Props & { personas: Persona[] }) {
  const router = useRouter();
  const [cast, on] = useCast(source, personas, product, (action) => {
    if (action.type === 'saved') router.refresh();
  });
  return (
    <div className="business-personas">
      {!cast.drawer && cast.refusal && <p className="business-refusal" role="alert">{cast.refusal}</p>}
      {cast.drawer
        ? <Drawer state={cast} on={on} />
        : <button type="button" className="ask-button quiet business-add-persona" onClick={on.open} disabled={cast.busy}>{ADD_PERSONA}</button>}
    </div>
  );
}
