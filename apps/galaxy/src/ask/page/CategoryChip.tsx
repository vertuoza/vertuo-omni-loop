import { Select } from '@omni/ui';
import { CATEGORIES, CATEGORY_LABELS, isCategory, type Category } from '../classify';
import type { ChipView } from './view';

// A round's category chip (PRD 144): one of six, or unsorted, and who set it. Any member of the
// session's workspace may change it, so it is a Select; it is off while a change saves, or where no
// change can be saved.

const UNSORTED = 'unsorted';
const OPTIONS = [{ value: UNSORTED, label: 'unsorted' }, ...CATEGORIES.map((category) => ({ value: category, label: CATEGORY_LABELS[category] }))];

type Props = { chip: ChipView; onChange?: (category: Category | null) => void; saving?: boolean };

export function CategoryChip({ chip, onChange, saving = false }: Props) {
  return (
    <span className="ask-category" data-category={chip.value ?? 'unsorted'}>
      <Select
        size="sm"
        label="Category"
        options={OPTIONS}
        value={chip.value ?? UNSORTED}
        disabled={!onChange || saving}
        onValueChange={(picked) => onChange?.(isCategory(picked) ? picked : null)}
      />
      {chip.setBy && <span className="ask-category-by">{chip.setBy}</span>}
    </span>
  );
}
