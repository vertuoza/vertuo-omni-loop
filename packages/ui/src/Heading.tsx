import type { ReactNode } from 'react';
import './Heading.css';
import type { HEADING_LEVELS, HEADING_SIZES } from './Heading.meta.ts';

export type HeadingProps = {
  /** The level in the document outline: it never skips one. The look is `size`. */
  level?: (typeof HEADING_LEVELS)[number];
  size?: (typeof HEADING_SIZES)[number];
  children?: ReactNode;
};

/** A heading of the document outline at a step of the type scale. */
export function Heading({ level = '2', size = 'section', children }: HeadingProps) {
  const className = `omni-heading omni-heading--${size}`;
  switch (level) {
    case '1':
      return <h1 className={className}>{children}</h1>;
    case '2':
      return <h2 className={className}>{children}</h2>;
    case '3':
      return <h3 className={className}>{children}</h3>;
    case '4':
      return <h4 className={className}>{children}</h4>;
  }
}
