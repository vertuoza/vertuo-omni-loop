import { drawIcon } from '@omni/design';
import type { IconName } from '@omni/design';
import './Icon.css';
import type { ICON_SIZES } from './Icon.meta.ts';

export type IconProps = {
  /** Which icon of the 1-bit set. */
  name: IconName;
  /** `md` draws the 16 px grid as it is; `lg` doubles it, a whole-number scale, so it stays crisp. */
  size?: (typeof ICON_SIZES)[number];
  /** What the icon says when it stands alone; without it the icon is decoration and is hidden from a screen reader. */
  label?: string;
};

/** A 1-bit pixel icon in the ink of whatever holds it. */
export function Icon({ name, size = 'md', label }: IconProps) {
  const svg = drawIcon(name, size === 'lg' ? 2 : 1).replace(/ role="img" aria-label="[^"]*"/, ' aria-hidden="true" focusable="false"');
  return label === undefined
    ? <span className={`omni-icon omni-icon--${size}`} aria-hidden="true" dangerouslySetInnerHTML={{ __html: svg }} />
    : <span className={`omni-icon omni-icon--${size}`} role="img" aria-label={label} dangerouslySetInnerHTML={{ __html: svg }} />;
}
