import './PersonRef.css';
import { Link } from './Link.tsx';
import type { PERSON_REF_VARIANTS } from './PersonRef.meta.ts';

export type PersonRefProps = {
  name: string;
  /** The person's page. */
  href: string;
  variant?: (typeof PERSON_REF_VARIANTS)[number];
};

/** A person named in text: their name, as one link to their page. */
export function PersonRef({ name, href, variant = 'default' }: PersonRefProps) {
  return (
    <span className="omni-person-ref">
      <Link href={href} variant={variant}>{name}</Link>
    </span>
  );
}
