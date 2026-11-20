import { useId } from 'react';
import type { ReactNode } from 'react';
import './ReviewScreen.css';

/** One numbered reading section: its heading and what it holds (prose inside it keeps a 900 px measure). */
export type ReviewSection = {
  /** The step's name: `What changed`. The part numbers it. */
  title: string;
  children: ReactNode;
};

export type ReviewScreenProps = {
  title: string;
  /** A short line above the title: the item the decision is about. */
  eyebrow?: string;
  /** One sentence under the title. */
  lede?: string;
  /** The sections, in reading order: the step list and the numbers follow it. */
  sections: readonly ReviewSection[];
  /** The name of the last step, the decision bar: `Decide`. */
  decideLabel?: string;
  /** The name of the step list's navigation landmark. */
  stepsLabel?: string;
  /** What is asked, in the decision bar: `Approve this spec and plan?` */
  question: string;
  /** A line under the question. */
  detail?: string;
  /** Secondary actions, left of the decision: Buttons. */
  secondary?: ReactNode;
  /** The one decision: a primary Button. */
  decision: ReactNode;
};

/** A focused, full-width screen: the sections in order, a step list beside them, a decision bar at the bottom of the window. */
export function ReviewScreen({ title, eyebrow, lede, sections, decideLabel = 'Decide', stepsLabel = 'Steps', question, detail, secondary, decision }: ReviewScreenProps) {
  const base = useId();
  const sectionId = (index: number) => `${base}-section-${String(index + 1)}`;
  const decideId = `${base}-decide`;
  return (
    <div className="omni-review">
      <header className="omni-review__head">
        {eyebrow === undefined ? null : <p className="omni-review__eyebrow">{eyebrow}</p>}
        <h1 className="omni-review__title">{title}</h1>
        {lede === undefined ? null : <p className="omni-review__lede">{lede}</p>}
      </header>
      <div className="omni-review__body">
        <nav className="omni-review__steps" aria-label={stepsLabel}>
          <ol className="omni-review__step-list">
            {sections.map((section, index) => (
              <li key={`${String(index)}-${section.title}`}>
                <a className="omni-review__step" href={`#${sectionId(index)}`}>{`${String(index + 1)} · ${section.title}`}</a>
              </li>
            ))}
            <li><a className="omni-review__step" href={`#${decideId}`}>{decideLabel}</a></li>
          </ol>
        </nav>
        <div className="omni-review__sections">
          {sections.map((section, index) => (
            <div className="omni-review__section" key={`${String(index)}-${section.title}`}>
              <h2 className="omni-review__heading" id={sectionId(index)}>{`${String(index + 1)} · ${section.title}`}</h2>
              <div className="omni-review__prose">{section.children}</div>
            </div>
          ))}
        </div>
      </div>
      <div className="omni-review__bar" id={decideId} role="group" aria-labelledby={`${decideId}-question`}>
        <div className="omni-review__ask">
          <p className="omni-review__question" id={`${decideId}-question`}>{question}</p>
          {detail === undefined ? null : <p className="omni-review__detail">{detail}</p>}
        </div>
        <div className="omni-review__decide">
          {secondary}
          {decision}
        </div>
      </div>
    </div>
  );
}
