import type { ReactNode } from 'react';
import './DefinitionList.css';
import type { DEFINITION_LIST_DENSITIES } from './DefinitionList.meta.ts';

export type DefinitionFact = {
  id: string;
  /** What the fact is: a short label. */
  label: ReactNode;
  /** The fact. Left empty, the fact is left out of the list. */
  value?: ReactNode;
};

export type DefinitionListProps = {
  facts: readonly DefinitionFact[];
  density?: (typeof DEFINITION_LIST_DENSITIES)[number];
};

/** Whether a value says something: null, undefined, false and a blank string do not. */
function hasValue(value: ReactNode): boolean {
  if (value === null || value === undefined || value === false) return false;
  return typeof value !== 'string' || value.trim() !== '';
}

/** The facts beside a page's main content, each label over its value; a fact with no value is left out, never drawn as a dash. */
export function DefinitionList({ facts, density = 'normal' }: DefinitionListProps) {
  return (
    <dl className={`omni-definition-list omni-definition-list--${density}`}>
      {facts.filter((fact) => hasValue(fact.value)).map((fact) => (
        <div key={fact.id} className="omni-definition-list__fact">
          <dt className="omni-definition-list__label">{fact.label}</dt>
          <dd className="omni-definition-list__value">{fact.value}</dd>
        </div>
      ))}
    </dl>
  );
}
