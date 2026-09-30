import { redirect } from 'next/navigation';
import { SETTINGS_LANDING } from '../../../src/nav/sidebar';

// /app/settings, the menu's Settings entry (PRD 733): no page of its own, it lands on the Fleets tab,
// SETTINGS_LANDING (src/nav/sidebar.ts, where its target is tested).

export default function SettingsPage(): never {
  redirect(SETTINGS_LANDING);
}
