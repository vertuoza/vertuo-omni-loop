import { HOME, SECTIONS } from '../../src/switch/switch';

// /app: a heading, its line, and one card per section of the app (SECTIONS), each a link to its
// page. Every page it opens signs the visitor in on its own; this one reads nothing.

export default function AppHome() {
  return (
    <div className="ask-col app-home">
      <div className="app-intro">
        <h1 className="app-heading">{HOME.heading}</h1>
        <p className="app-line">{HOME.line}</p>
      </div>
      <ul className="app-cards">
        {SECTIONS.map((section) => (
          <li key={section.path}>
            <a className="app-card" href={section.path}>
              <span className="app-card-title">{section.title}</span>
              <span className="app-card-line">{section.line}</span>
              <code className="app-card-path">{section.path}</code>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
