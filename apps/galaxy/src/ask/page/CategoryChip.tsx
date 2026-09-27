import { CATEGORIES, CATEGORY_LABELS, isCategory, type Category } from '../classify';
import type { ChipView } from './view';

// A round's category chip (PRD 144): one of six, or unsorted, and who set it. Any member of the
// session's workspace may change it, so it is a select; it is off while a change saves, or where no
// change can be saved.

type Props = { chip: ChipView; onChange?: (category: Category | null) => void; saving?: boolean };

export function CategoryChip({ chip, onChange, saving = false }: Props) {
  return (
    <span className="ask-category" data-category={chip.value ?? 'unsorted'}>
      <select
        className="ask-category-pick"
        aria-label="Category"
        value={chip.value ?? ''}
        disabled={!onChange || saving}
        onChange={(event) => onChange?.(isCategory(event.target.value) ? event.target.value : null)}
      >
        <option value="">unsorted</option>
        {CATEGORIES.map((category) => (
          <option key={category} value={category}>{CATEGORY_LABELS[category]}</option>
        ))}
      </select>
      {chip.setBy && <span className="ask-category-by">{chip.setBy}</span>}
    </span>
  );
}
