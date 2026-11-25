import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import * as ui from '@omni/ui';
import { DesignScreen } from './DesignScreen';

// The five settings parts are listed on /design by the register itself: this proves the page shows
// each of them with its usage, its do and its don't, and that the package exports them.

const SETTINGS_PARTS = ['SettingsHeader', 'SettingsSection', 'SettingsRow', 'SettingsField', 'SettingsSaveBar'] as const;
const html = renderToStaticMarkup(createElement(DesignScreen));

const card = (name: string) => {
  const at = html.indexOf(`<article id="${name}"`);
  expect(at, name).toBeGreaterThanOrEqual(0);
  return html.slice(at, html.indexOf('</article>', at));
};

describe('the settings parts on /design', () => {
  for (const name of SETTINGS_PARTS) {
    it(`AC-5: ${name} is exported and shown with its usage, do and don't`, () => {
      expect(ui).toHaveProperty(name);
      const markup = card(name);
      expect(markup).toContain('class="ds-note"');
      expect(markup).toContain('<strong>Do</strong>');
      expect(markup).toContain('<strong>Don’t</strong>');
      expect(markup).toContain(`aria-label="${name} example"`);
    });
  }
});
