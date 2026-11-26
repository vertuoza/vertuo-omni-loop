import type { ReactNode } from 'react';
import './SettingsSection.css';
import { Section } from './Section.tsx';

export type SettingsSectionProps = {
  /** The heading of the group of settings. */
  title: ReactNode;
  /** A quieter line under the heading, or none. */
  description?: ReactNode;
  /** The SettingsRow parts of the group. */
  children?: ReactNode;
};

/** A group of settings rows under one heading. */
export function SettingsSection({ title, description, children }: SettingsSectionProps) {
  return (
    <div className="omni-settings-section">
      <Section title={title} {...(description === undefined ? {} : { description })}>
        <div className="omni-settings-section__rows">{children}</div>
      </Section>
    </div>
  );
}
