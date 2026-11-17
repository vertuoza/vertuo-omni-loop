import type { ReactNode } from 'react';
import './Text.css';
import type { TEXT_ELEMENTS, TEXT_SIZES, TEXT_TONES } from './Text.meta.ts';

export type TextProps = {
  /** The element, for the document outline; the look is `size`. */
  as?: (typeof TEXT_ELEMENTS)[number];
  size?: (typeof TEXT_SIZES)[number];
  tone?: (typeof TEXT_TONES)[number];
  strong?: boolean;
  children?: ReactNode;
};

/** A run of text at a step of the type scale, in a tone: the one way a page sets type. */
export function Text({ as = 'p', size = 'body', tone = 'primary', strong = false, children }: TextProps) {
  const classes = ['omni-text', `omni-text--${size}`, `omni-text--${tone}`];
  if (strong) classes.push('omni-text--strong');
  const className = classes.join(' ');
  switch (as) {
    case 'span':
      return <span className={className}>{children}</span>;
    case 'h1':
      return <h1 className={className}>{children}</h1>;
    case 'h2':
      return <h2 className={className}>{children}</h2>;
    case 'h3':
      return <h3 className={className}>{children}</h3>;
    case 'h4':
      return <h4 className={className}>{children}</h4>;
    case 'p':
      return <p className={className}>{children}</p>;
  }
}
