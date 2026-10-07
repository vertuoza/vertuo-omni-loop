import { defaultPitchSettings, parsePitchSettings, type PitchSettings } from 'vertuo-omni-plan/kit/lib/pitch/settings.ts';

// Settings › Products as pure data (PRD 859 s1). A product of the workspace's business
// (supabase/migrations/20261019090000_business_store.sql) with the look its pitches are drawn in
// (20261101090000_products_pitch_look.sql): Arcade poster, the default, or Clean keynote. The look is
// per product, never per workspace. A product's own page is /app/settings/products/<id>, and holds its
// whole Pitch settings (PRD 1108 s2, 20261107090000_pitch_settings.sql); the page's state is
// pitch-form-model.ts's.

export const PITCH_LOOKS = [
  { value: 'arcade', label: 'Arcade poster' },
  { value: 'keynote', label: 'Clean keynote' },
] as const;

export type PitchLook = (typeof PITCH_LOOKS)[number]['value'];

/** The look a product starts in, and the one a repository with no product reads. */
export const DEFAULT_LOOK: PitchLook = 'arcade';

export const isPitchLook = (value: unknown): value is PitchLook => PITCH_LOOKS.some((l) => l.value === value);

/** A stored look as the page reads it: anything but a known look reads as the default. */
export const lookOf = (value: unknown): PitchLook => (isPitchLook(value) ? value : DEFAULT_LOOK);

export const lookLabel = (look: PitchLook): string => PITCH_LOOKS.find((l) => l.value === look)?.label ?? look;

export interface ProductRow {
  id: string;
  name: string;
  look: PitchLook;
}

/** A product as its own page reads it: with its Pitch settings, filled. */
export interface PitchedProduct extends ProductRow {
  pitch: PitchSettings;
}

/** A public.products row, as PostgREST answers it. */
export interface StoredProduct {
  id: string;
  name: string;
  pitch_look?: string | null;
  pitch?: unknown;
}

export const PRODUCT_COLUMNS = 'id, name, pitch_look, pitch';

export const rowOf = (row: StoredProduct): ProductRow => ({ id: row.id, name: row.name, look: lookOf(row.pitch_look) });

/**
 * The Pitch settings a stored row holds, filled from its preset and the defaults. A row with none
 * reads as its look's preset; one out of shape (the database refuses most of that) reads the same,
 * so the page always opens.
 */
export function pitchOf(row: StoredProduct): PitchSettings {
  const parsed = row.pitch === undefined || row.pitch === null ? null : parsePitchSettings(row.pitch);
  return parsed?.ok ? parsed.settings : defaultPitchSettings(lookOf(row.pitch_look));
}

export const pitchedOf = (row: StoredProduct): PitchedProduct => ({ ...rowOf(row), pitch: pitchOf(row) });

export const PRODUCTS_HREF = '/app/settings/products';

export const productHref = (id: string) => `${PRODUCTS_HREF}/${encodeURIComponent(id)}`;
