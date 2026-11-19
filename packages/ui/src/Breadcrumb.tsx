import './Breadcrumb.css';
import { Link } from './Link.tsx';

export type Crumb = {
  label: string;
  /** Every crumb but the last has one. */
  href?: string;
};

export type BreadcrumbProps = {
  items: readonly Crumb[];
  /** The name of the navigation landmark; unique on a page that holds more than one. */
  label?: string;
};

/** The path to the current page: links up, then the page itself, marked `aria-current`. */
export function Breadcrumb({ items, label = 'Breadcrumb' }: BreadcrumbProps) {
  const last = items.length - 1;
  return (
    <nav className="omni-breadcrumb" aria-label={label}>
      <ol className="omni-breadcrumb__list">
        {items.map((item, index) => (
          <li className="omni-breadcrumb__item" key={`${String(index)}-${item.label}`}>
            {index === last || item.href === undefined
              ? <span {...(index === last ? { 'aria-current': 'page' as const } : {})} className="omni-breadcrumb__current">{item.label}</span>
              : <Link href={item.href} variant="quiet">{item.label}</Link>}
            {index === last ? null : <span className="omni-breadcrumb__sep" aria-hidden="true">/</span>}
          </li>
        ))}
      </ol>
    </nav>
  );
}
