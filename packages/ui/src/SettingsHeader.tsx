import type { ReactNode } from 'react';
import './SettingsHeader.css';
import { Heading } from './Heading.tsx';
import type { SETTINGS_HEADER_LEVELS } from './SettingsHeader.meta.ts';

export type SettingsHeaderProps = {
  /** The title of the settings page. */
  title: ReactNode;
  /** A quieter line under the title, or none. */
  description?: ReactNode;
  /** The level in the document outline: 1 for a page of its own, 2 when it sits under another page's title. */
  level?: (typeof SETTINGS_HEADER_LEVELS)[number];
};

/** The top of a settings page: its title, and an optional line saying what the page holds. */
export function SettingsHeader({ title, description, level = '1' }: SettingsHeaderProps) {
  return (
    <header className="omni-settings-header">
      <Heading level={level} size="page">
        {title}
      </Heading>
      {description === undefined ? null : <p className="omni-settings-header__description">{description}</p>}
    </header>
  );
}
