import type { ReactNode } from 'react';
import './SettingsHeader.css';
import { Heading } from './Heading.tsx';

export type SettingsHeaderProps = {
  /** The title of the settings page. */
  title: ReactNode;
  /** A quieter line under the title, or none. */
  description?: ReactNode;
};

/** The top of a settings page: its title, and an optional line saying what the page holds. */
export function SettingsHeader({ title, description }: SettingsHeaderProps) {
  return (
    <header className="omni-settings-header">
      <Heading level="1" size="page">
        {title}
      </Heading>
      {description === undefined ? null : <p className="omni-settings-header__description">{description}</p>}
    </header>
  );
}
