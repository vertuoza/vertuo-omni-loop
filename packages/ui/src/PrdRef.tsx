import './PrdRef.css';
import { Link } from './Link.tsx';
import type { PRD_REF_VARIANTS } from './PrdRef.meta.ts';

export type PrdRefProps = {
  number: number;
  /** The PRD's title, said after its number. */
  title?: string;
  /** The PRD's page. */
  href: string;
  variant?: (typeof PRD_REF_VARIANTS)[number];
};

/** A PRD named in text: "PRD 12", and its title, as one link to its page. */
export function PrdRef({ number, title, href, variant = 'default' }: PrdRefProps) {
  const name = `PRD ${String(number)}`;
  return (
    <span className="omni-prd-ref">
      <Link href={href} variant={variant}>{title === undefined ? name : `${name} ${title}`}</Link>
    </span>
  );
}
