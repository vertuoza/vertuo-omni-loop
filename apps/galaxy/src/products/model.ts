// Settings › Products as pure data (PRD 859 s1). A product of the workspace's business
// (supabase/migrations/20261019090000_business_store.sql) with the look its pitches are drawn in
// (20261029090000_products_pitch_look.sql): Arcade poster, the default, or Clean keynote. The look is
// per product, never per workspace. A product's own page is /app/settings/products/<id>; the page's
// state follows one change of its look at a time.

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

/** A public.products row, as PostgREST answers it. */
export interface StoredProduct {
  id: string;
  name: string;
  pitch_look?: string | null;
}

export const PRODUCT_COLUMNS = 'id, name, pitch_look';

export const rowOf = (row: StoredProduct): ProductRow => ({ id: row.id, name: row.name, look: lookOf(row.pitch_look) });

export const PRODUCTS_HREF = '/app/settings/products';

export const productHref = (id: string) => `${PRODUCTS_HREF}/${encodeURIComponent(id)}`;

// ── The product page's state ─────────────────────────────────────────────────────

export interface ProductState {
  product: ProductRow;
  /** A change is on its way: the dropdown waits. */
  busy: boolean;
  /** What the last change was refused with, or null. */
  refusal: string | null;
}

export type ProductAction =
  | { type: 'busy' }
  | { type: 'saved'; product: ProductRow }
  | { type: 'refused'; message: string };

export const initialProductState = (product: ProductRow): ProductState => ({ product, busy: false, refusal: null });

export function productReducer(state: ProductState, action: ProductAction): ProductState {
  switch (action.type) {
    case 'busy':
      return { ...state, busy: true, refusal: null };
    case 'saved':
      return { product: action.product, busy: false, refusal: null };
    case 'refused':
      return { ...state, busy: false, refusal: action.message };
  }
}
