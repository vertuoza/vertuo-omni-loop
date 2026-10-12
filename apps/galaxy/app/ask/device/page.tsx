import 'server-only';
import type { Metadata } from 'next';
import { DevicePage } from '../../../src/ask/device-card';
import { deviceView, readDeviceQuery } from '../../../src/ask/device-card.controller';
import { deviceLive } from '../../../src/ask/device.live';
import { serverEnv } from '../../../src/env';

// /ask/device?user_code=<c>: the page a device sign-in's link opens (PRD 1660), for `omni signin` or
// `omni setup-token` running where this browser cannot reach them. It shows the code and asks whether
// the terminal shows it; Yes opens the sign-in card, coming back through the auth callback's device=
// branch, which hands the terminal its sign-in on its next poll; No refuses the request
// (./deny/route.ts). Without a code it shows a box to type one. Rendered per request.

export const metadata: Metadata = { title: 'Sign a terminal in · OMNI LOOP' };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function AskDevicePage({ searchParams }: Props) {
  const supabase = serverEnv().supabase;
  const view = await deviceView(readDeviceQuery(await searchParams), supabase ? deviceLive() : null);
  return <DevicePage view={view} supabase={supabase} />;
}
