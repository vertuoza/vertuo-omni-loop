import { SECTIONS } from '../switch/switch';

// The app's sections (PRD 238's cards), drawn compact at the foot of the dashboard (PRD 328): a title
// and an arrow each, on one row that wraps. The list is src/switch/switch.ts's SECTIONS.

export function SectionCards() {
  return (
    <nav className="dash-cards" aria-label="The app’s sections">
      <ul>
        {SECTIONS.map((section) => (
          <li key={section.path}>
            <a className="dash-card" href={section.path}>{section.title}</a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
