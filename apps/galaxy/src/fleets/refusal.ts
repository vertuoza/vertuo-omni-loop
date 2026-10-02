// A refusal from the fleet functions (supabase/migrations/20261003090000_own_fleets.sql, PRD 400), as
// /app/settings/fleets shows it. A field's refusal carries SQLSTATE 22023 and the field's name as its hint,
// and its message starts with the field ("Label: 1 to 12 characters."): the page shows that message
// next to the field. `fleets` is the cap of 12 active fleets. Anything else belongs to the form.

/** A place on the page a refusal is shown: one of the form's fields, the fleet count, or the form. */
export type RefusalField = 'label' | 'color' | 'motto' | 'mascot' | 'fleets' | 'form';

export interface Refusal {
  field: RefusalField;
  message: string;
}

const FIELDS: readonly RefusalField[] = ['label', 'color', 'motto', 'mascot', 'fleets'];

export const NOT_OWNER = 'Only the workspace’s owner can change its fleets.';
export const GONE = 'That fleet is no longer in this workspace. Reload the page.';
export const COULD_NOT_SAVE = 'Couldn’t save this. Try again in a moment.';

/** An error as PostgREST answers it (code, hint, message), or anything thrown. */
export function refusalOf(error: unknown): Refusal {
  const { code, hint, message } = (error ?? {}) as { code?: unknown; hint?: unknown; message?: unknown }; // ts-allow: anything thrown is read for these three fields, each checked below
  if (code === '42501') return { field: 'form', message: NOT_OWNER };
  if (code === 'P0002') return { field: 'form', message: GONE };
  if (code === '22023' && typeof message === 'string' && message) {
    const field = FIELDS.find((f) => f === hint);
    return { field: field ?? 'form', message };
  }
  return { field: 'form', message: COULD_NOT_SAVE };
}
