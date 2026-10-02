import { validPersonaAvatar } from '@omni/design';
import { NAME_MAX, personaOf, STANCES, TEXT_MAX, type Persona, type PersonaFields, type StoredPersona } from './personas';
import { propertyOf } from 'vertuo-omni-plan/kit/lib/narrow.ts';

// Settings → Business → Personas' calls (PRD 799 s3). In production, the functions of
// supabase/migrations/20261022090000_personas.sql, called as the signed-in person: persona_add(),
// persona_edit(), persona_delete() and persona_restore() (Undo), each answering the public.personas row
// it saved, or refusing: 42501 not a member, P0002 gone, 22023 invalid with the field in `hint`. In the
// demo, the same rules kept in memory, so the section can be tried with no database.

export type SavedPersona = { ok: true; persona: Persona } | { ok: false; message: string };

export interface PersonaPort {
  add(product: string, fields: PersonaFields): Promise<SavedPersona>;
  edit(persona: string, fields: PersonaFields): Promise<SavedPersona>;
  /** Deletes a persona at once; restore() brings it back. */
  remove(persona: string): Promise<SavedPersona>;
  restore(persona: string): Promise<SavedPersona>;
}

export const NOT_MEMBER = 'Only a member of the workspace can change its personas.';
export const GONE = 'That persona is no longer here. Reload the page.';
export const COULD_NOT_SAVE = 'Couldn’t save this. Try again in a moment.';

/** What a 22023 says, by the field its `hint` names. */
export const INVALID_FIELD: Readonly<Record<string, string>> = {
  name: `A name: 1 to ${NAME_MAX} characters, on one line.`,
  stance: 'Pick a stance: excited, neutral or skeptical.',
  trade: 'Pick a trade from the list.',
  avatar: 'Pick a portrait from the picker.',
  who: `Who they are: ${TEXT_MAX} characters at most.`,
  usage: `How they use it: ${TEXT_MAX} characters at most.`,
  product: 'Reload the page, then add the persona again.',
};
const INVALID = 'That can’t be saved. Check each field.';

/** An error as PostgREST answers it, or anything thrown, as the section says it. */
export function personaRefusalOf(error: unknown): string {
  const code = propertyOf(error, 'code');
  const hint = propertyOf(error, 'hint');
  if (code === '42501') return NOT_MEMBER;
  if (code === 'P0002') return GONE;
  if (code === '22023') return INVALID_FIELD[String(hint)] ?? INVALID;
  return COULD_NOT_SAVE;
}

type Rpc = { rpc(fn: string, args: Record<string, unknown>): PromiseLike<{ data: unknown; error: unknown }> };

const argsOf = (f: PersonaFields) => ({
  p_name: f.name, p_stance: f.stance, p_trade: f.trade, p_avatar: f.avatar, p_who: f.who, p_usage: f.usage,
});

export function databasePersonas(db: Rpc, workspace: string): PersonaPort {
  const call = async (fn: string, args: Record<string, unknown>): Promise<SavedPersona> => {
    try {
      const { data, error } = await db.rpc(fn, { p_workspace: workspace, ...args });
      if (error || !data) return { ok: false, message: personaRefusalOf(error) };
      return { ok: true, persona: personaOf(data as StoredPersona) }; // ts-allow: each persona function answers the public.personas row it wrote
    } catch (err) {
      return { ok: false, message: personaRefusalOf(err) };
    }
  };
  return {
    add: (product, fields) => call('persona_add', { p_product: product, ...argsOf(fields) }),
    edit: (persona, fields) => call('persona_edit', { p_persona: persona, ...argsOf(fields) }),
    remove: (persona) => call('persona_delete', { p_persona: persona }),
    restore: (persona) => call('persona_restore', { p_persona: persona }),
  };
}

const badName = (name: string) => name.length < 1 || name.length > NAME_MAX || /[\r\n\t]/.test(name);
const badText = (text: string) => text.trim().length > TEXT_MAX;

/** persona_fields()'s checks, in its order: each field, and whether a value breaks it. */
const FIELD_CHECKS: ReadonlyArray<readonly [string, (f: PersonaFields) => boolean]> = [
  ['name', (f) => badName(f.name.trim())],
  ['stance', (f) => !STANCES.includes(f.stance)],
  ['trade', (f) => !/^[a-z]+$/.test(f.trade) || f.trade.length > 40],
  ['avatar', (f) => !validPersonaAvatar(f.avatar)],
  ['who', (f) => badText(f.who)],
  ['usage', (f) => badText(f.usage)],
];

/** persona_fields()'s checks: the field a value breaks, or null. */
function invalidField(f: PersonaFields): string | null {
  return FIELD_CHECKS.find(([, breaks]) => breaks(f))?.[0] ?? null;
}

const trimmed = (f: PersonaFields): PersonaFields => ({ ...f, name: f.name.trim(), who: f.who.trim(), usage: f.usage.trim() });

/** The persona functions' rules on personas kept in memory. */
export function demoPersonasPort(initial: readonly Persona[] = []): PersonaPort {
  let personas = [...initial];
  const deleted = new Map<string, Persona>();
  let next = Math.max(0, ...initial.map((p) => p.ordinal)) + 1;
  const refused = (field: string): SavedPersona => ({ ok: false, message: INVALID_FIELD[field] ?? INVALID });
  return {
    add(product, fields) {
      const bad = invalidField(fields);
      if (bad) return Promise.resolve(refused(bad));
      const persona: Persona = { id: `demo-persona-${next}`, product, ordinal: next, ...trimmed(fields) };
      next += 1;
      personas = [...personas, persona];
      return Promise.resolve({ ok: true, persona });
    },
    edit(id, fields) {
      const bad = invalidField(fields);
      if (bad) return Promise.resolve(refused(bad));
      const kept = personas.find((p) => p.id === id);
      if (!kept) return Promise.resolve({ ok: false, message: GONE });
      const persona = { ...kept, ...trimmed(fields) };
      personas = personas.map((p) => (p.id === id ? persona : p));
      return Promise.resolve({ ok: true, persona });
    },
    remove(id) {
      const kept = personas.find((p) => p.id === id);
      if (!kept) return Promise.resolve({ ok: false, message: GONE });
      personas = personas.filter((p) => p.id !== id);
      deleted.set(id, kept);
      return Promise.resolve({ ok: true, persona: kept });
    },
    restore(id) {
      const kept = deleted.get(id);
      if (!kept) return Promise.resolve({ ok: false, message: GONE });
      deleted.delete(id);
      personas = [...personas, kept];
      return Promise.resolve({ ok: true, persona: kept });
    },
  };
}
