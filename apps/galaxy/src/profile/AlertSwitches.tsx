'use client';
import { useEffect, useState, type ReactNode } from 'react';
import { liveBrowserFacts, livePushBrowser, thisDeviceSubscribed, type Done } from '../push/client';
import { pushSupport, type AlertChannels, type PushSupport } from '../push/device';
import { ALERTS_LINE, emailLabel, phoneHint, turnEmail, turnPhone, type AlertsHeld } from './alerts';

// Your two alert switches on your own profile (PRD 1322 s9): **Phone alerts on this device** and
// **Email · <address>**, both off until you turn them on. The server draws them as stored; once the
// page runs, it learns whether this browser can be subscribed (an iPhone only from the home screen)
// and whether this device is, and Phone alerts reads on only when both the switch and this device
// are. Each press runs one call at a time (./alerts.ts) and says why when it could not.

export interface AlertSwitchesProps {
  channels: AlertChannels;
  /** Your GitHub sign-in's address, or null when it has none. */
  email: string | null;
  /** The VAPID public key, or null when this deployment has no Web Push. */
  publicKey: string | null;
}

function Switch({ label, on, disabled, press, children }: { label: string; on: boolean; disabled: boolean; press: () => void; children?: ReactNode }) {
  return (
    <li className="profile-alert">
      <span>{label}</span>
      <button type="button" role="switch" aria-checked={on} aria-label={label} className="profile-alert-toggle" onClick={press} disabled={disabled} />
      {children}
    </li>
  );
}

/** Whether this browser can be subscribed, learnt once the page runs (null before), and whether this
 * device is, written into the switches when it can. */
function usePushSupport(setHeld: (update: (held: AlertsHeld) => AlertsHeld) => void): PushSupport | null {
  const [support, setSupport] = useState<PushSupport | null>(null);
  useEffect(() => {
    const found = pushSupport(liveBrowserFacts());
    setSupport(found);
    if (found !== 'ready') return;
    let live = true;
    void thisDeviceSubscribed(livePushBrowser()).then((device) => {
      if (live) setHeld((held) => ({ ...held, device }));
    });
    return () => { live = false; };
  }, [setHeld]);
  return support;
}

export function AlertSwitches({ channels, email, publicKey }: AlertSwitchesProps) {
  const [held, setHeld] = useState<AlertsHeld>({ channels, device: channels.push });
  const support = usePushSupport(setHeld);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const run = async (press: () => Promise<Done<AlertsHeld>>) => {
    if (busy) return;
    setBusy(true);
    setMessage(null);
    const done = await press();
    setBusy(false);
    if (done.ok) setHeld(done.value);
    else setMessage(done.message);
  };

  const phoneOn = held.channels.push && held.device;
  const hint = phoneHint(publicKey, support);
  const pressPhone = () => turnPhone(!phoneOn, held, livePushBrowser(), publicKey ?? '', support ?? pushSupport(liveBrowserFacts()));
  const pressEmail = () => turnEmail(!held.channels.email, held, livePushBrowser());

  return (
    <>
      <ul className="profile-alerts">
        <Switch label={ALERTS_LINE.phone} on={phoneOn} disabled={busy || (publicKey === null && !phoneOn)} press={() => void run(pressPhone)}>
          {hint && <p className="profile-alert-hint">{hint}</p>}
        </Switch>
        <Switch label={emailLabel(email)} on={held.channels.email} disabled={busy || (email === null && !held.channels.email)} press={() => void run(pressEmail)} />
      </ul>
      {message && <p className="profile-alert-message" role="status">{message}</p>}
    </>
  );
}
