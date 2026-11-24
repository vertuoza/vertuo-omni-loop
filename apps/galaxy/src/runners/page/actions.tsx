'use client';
import { Select } from '@omni/ui';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { poll } from '../../ask/page/poll';
import { copyLink } from '../../ask/page/share';
import { cancelRunnerJob, sendToRunner, setRunnerFleet, type Called } from '../runners.client';
import { postFixWithAnswers } from './fix.client';
import type { Target } from '../runners.contract';
import { REFRESH_MS } from './model';

// The Runners page's controls (PRD 1830 s3), the only parts of it that run in the browser: an owner's
// fleet picker, Cancel, Send again, and the refresh that reads the rows again every 5 s while the tab is
// visible (router.refresh(): the server draws the page again, in place). Each control calls its route
// through ../runners.client.ts, then reads the rows again; a refusal shows its words beside the control.

function useAct() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  async function act(call: () => Promise<Called<unknown>>) {
    setBusy(true);
    setProblem(null);
    const called = await call();
    setBusy(false);
    if (called.ok) router.refresh();
    else setProblem(called.error);
  }
  return { busy, problem, act };
}

const Problem = ({ problem }: { problem: string | null }) => (problem ? <span className="runners-problem" role="alert">{problem}</span> : null);

/** A workspace owner's fleet picker: Shared, then each fleet. */
export function FleetPicker({ runner, name, value, options }: { runner: string; name: string; value: string; options: readonly { value: string; label: string }[] }) {
  const { busy, problem, act } = useAct();
  return (
    <span className="runners-fleet" id={`runners-fleet-${runner}`}>
      <Select size="sm" label={`Fleet of ${name}`} defaultValue={value} disabled={busy} options={options}
        onValueChange={(fleet) => { void act(() => setRunnerFleet(runner, fleet === '' ? null : fleet)); }} />
      <Problem problem={problem} />
    </span>
  );
}

/** Cancel: a queued job at once, a running one at its runner's next report. */
export function CancelButton({ job }: { job: string }) {
  const { busy, problem, act } = useAct();
  return (
    <span className="runners-action">
      <button type="button" className="runners-ghost" disabled={busy} onClick={() => { void act(() => cancelRunnerJob(job)); }}>Cancel</button>
      <Problem problem={problem} />
    </span>
  );
}

/** A ghost button that calls a route, then reads the rows again; the page's one primary action when it is. */
function CallButton({ label, primary, call }: { label: string; primary: boolean; call: () => Promise<Called<unknown>> }) {
  const { busy, problem, act } = useAct();
  return (
    <span className="runners-action">
      <button type="button" className={primary ? 'runners-ghost is-primary' : 'runners-ghost'} data-primary={primary ? '' : undefined} disabled={busy}
        onClick={() => { void act(call); }}>{label}</button>
      <Problem problem={problem} />
    </span>
  );
}

/** Send again: the same line, for the same repository, to where it first went. */
export const SendAgainButton = ({ line, repo, target, primary }: { line: string; repo: string; target: Target; primary: boolean }) =>
  <CallButton label="Send again" primary={primary} call={() => sendToRunner(line, repo, target)} />;

/** Resume (PRD 2375): the line of a job that stopped mid-way, sent again exactly as Send again does, by the person who presses it. */
export const ResumeButton = ({ line, repo, target, primary }: { line: string; repo: string; target: Target; primary: boolean }) =>
  <CallButton label="Resume" primary={primary} call={() => sendToRunner(line, repo, target)} />;

/** Fix with answers (PRD 2270): `/omni:yolo-fix <n>` as the continuation of this job, to where it went. */
export const FixWithAnswersButton = ({ job, primary }: { job: string; primary: boolean }) =>
  <CallButton label="Fix with answers" primary={primary} call={() => postFixWithAnswers(job)} />;

/** Send to any runner (PRD 3232): the same line and repository, sent to Any runner by the person who presses it; the old job keeps its Cancel. */
export const SendToAnyButton = ({ line, repo }: { line: string; repo: string }) =>
  <CallButton label="Send to any runner" primary={false} call={() => sendToRunner(line, repo, { kind: 'any' })} />;

/** Show fleet (PRD 3232): scrolls to the runner's fleet picker and focuses it. */
export function ShowFleetButton({ runner }: { runner: string }) {
  return (
    <span className="runners-action">
      <button type="button" className="runners-ghost" onClick={() => {
        const picker = document.getElementById(`runners-fleet-${runner}`);
        if (picker === null) return;
        picker.scrollIntoView({ block: 'center' });
        picker.querySelector<HTMLElement>('button, select, [tabindex]')?.focus();
      }}>Show fleet</button>
    </span>
  );
}

/** A ghost button that copies a command to the clipboard and says so. */
export function CopyFixButton({ label, command }: { label: string; command: string }) {
  const [said, setSaid] = useState<string | null>(null);
  return (
    <span className="runners-action">
      <button type="button" className="runners-ghost" title={command} onClick={() => {
        void copyLink(command, navigator.clipboard, () => undefined).then((how) => { setSaid(how === 'copied' ? 'Copied.' : 'Copy it by hand.'); });
      }}>{label}</button>
      {said !== null && <span className="runners-muted" role="status">{said}</span>}
    </span>
  );
}

/** Reads the rows again every 5 s while the tab is visible. Draws nothing. */
export function Refresh() {
  const router = useRouter();
  useEffect(() => poll(() => { router.refresh(); return Promise.resolve(true); }, document, REFRESH_MS), [router]);
  return null;
}
