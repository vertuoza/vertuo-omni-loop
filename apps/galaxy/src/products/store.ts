import { propertyOf } from 'vertuo-omni-plan/kit/lib/narrow.ts';
import { parsePitchSettings, presetOf, type PitchSettings } from 'vertuo-omni-plan/kit/lib/pitch/settings.ts';
import { rowOf, type PitchLook, type ProductRow, type StoredProduct } from './model';

// Settings › Products's calls. In production, set_pitch_look() of
// supabase/migrations/20261101090000_products_pitch_look.sql (PRD 859 s1) and set_pitch_settings() of
// 20261107090000_pitch_settings.sql (PRD 1108 s1), called as the signed-in person: whoever may edit
// Settings › Business may change a product's look or its Pitch settings, and each answers the products
// row it saved, or refuses. Pitch settings are parsed with kit/lib/pitch/settings.ts before the call and
// saved filled, so a field out of shape is named before the database sees it. In the demo, the same
// rules kept in memory, so the page can be tried with no database.

export type Saved = { ok: true; product: ProductRow } | { ok: false; message: string };

export type SavedPitch = { ok: true; pitch: PitchSettings } | { ok: false; message: string };

export interface ProductsPort {
  /** Changes one product's pitch look; the workspace's other products keep theirs. */
  setLook(product: string, look: PitchLook): Promise<Saved>;
  /** Saves one product's Pitch settings, filled; the workspace's other products keep theirs. */
  setPitch(product: string, pitch: unknown): Promise<SavedPitch>;
}

export const NOT_EDITOR = 'Only someone who may edit the business can change a product’s look.';
export const GONE = 'That product is no longer in this workspace. Reload the page.';
export const COULD_NOT_SAVE = 'Couldn’t save this. Try again in a moment.';
export const OUT_OF_SHAPE = 'Check the Pitch settings:';

/** An error as PostgREST answers it, or anything thrown, as the page says it. */
export function refusalOf(error: unknown): string {
  const code = propertyOf(error, 'code');
  if (code === '42501') return NOT_EDITOR;
  if (code === 'P0002') return GONE;
  return COULD_NOT_SAVE;
}

/** The products row set_pitch_look() answered, read as it came, or null when it is not one. */
function storedOf(data: unknown): StoredProduct | null {
  const id = propertyOf(data, 'id');
  const name = propertyOf(data, 'name');
  const look = propertyOf(data, 'pitch_look');
  if (typeof id !== 'string' || typeof name !== 'string') return null;
  return { id, name, pitch_look: typeof look === 'string' ? look : null };
}

/** The Pitch settings a products row holds, filled, or null when it holds none in shape. */
function storedPitchOf(data: unknown): PitchSettings | null {
  if (typeof propertyOf(data, 'id') !== 'string') return null;
  const parsed = parsePitchSettings(propertyOf(data, 'pitch'));
  return parsed.ok ? parsed.settings : null;
}

/** Submitted settings, filled, or the refusal that names each field out of shape. */
function filledPitch(pitch: unknown): SavedPitch {
  const parsed = parsePitchSettings(pitch);
  return parsed.ok ? { ok: true, pitch: parsed.settings } : { ok: false, message: `${OUT_OF_SHAPE} ${parsed.errors.join('; ')}` };
}

/** set_pitch_settings()'s refusal, as the page says it. */
function pitchRefusalOf(error: unknown): string {
  const message = propertyOf(error, 'message');
  if (propertyOf(error, 'code') === '22023' && typeof message === 'string' && message) return `${OUT_OF_SHAPE} ${message}`;
  return refusalOf(error);
}

type Rpc = { rpc(fn: string, args: Record<string, unknown>): PromiseLike<{ data: unknown; error: unknown }> };

export function databaseProducts(db: Rpc, workspace: string): ProductsPort {
  return {
    async setLook(product, look) {
      try {
        const { data, error } = await db.rpc('set_pitch_look', { p_workspace: workspace, p_product: product, p_look: look });
        const stored = storedOf(data);
        if (error || !stored) return { ok: false, message: refusalOf(error) };
        return { ok: true, product: rowOf(stored) };
      } catch (err) {
        return { ok: false, message: refusalOf(err) };
      }
    },
    async setPitch(product, pitch) {
      const filled = filledPitch(pitch);
      if (!filled.ok) return filled;
      try {
        const { data, error } = await db.rpc('set_pitch_settings', { p_workspace: workspace, p_product: product, p_pitch: filled.pitch });
        const stored = storedPitchOf(data);
        if (error || !stored) return { ok: false, message: pitchRefusalOf(error) };
        return { ok: true, pitch: stored };
      } catch (err) {
        return { ok: false, message: refusalOf(err) };
      }
    },
  };
}

/** set_pitch_look()'s and set_pitch_settings()'s rules on products kept in memory. */
export function demoProductsPort(initial: ProductRow[]): ProductsPort {
  let rows = [...initial];
  const setLook = (id: string, look: PitchLook): Saved => {
    const kept = rows.find((r) => r.id === id);
    if (!kept) return { ok: false, message: GONE };
    const product = { ...kept, look };
    rows = rows.map((r) => (r === kept ? product : r));
    return { ok: true, product };
  };
  return {
    setLook: (id, look) => Promise.resolve(setLook(id, look)),
    setPitch(id, pitch) {
      const filled = filledPitch(pitch);
      if (!filled.ok) return Promise.resolve(filled);
      const saved = setLook(id, presetOf(filled.pitch));
      return Promise.resolve(saved.ok ? filled : saved);
    },
  };
}
