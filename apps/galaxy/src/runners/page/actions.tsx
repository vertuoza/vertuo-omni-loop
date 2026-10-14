'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { poll } from '../../ask/page/poll';
import { cancelRunnerJob, sendToRunner, setRunnerFleet, type Called } from '../runners.client';
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
    <span className="runners-fleet">
      <select aria-label={`Fleet of ${name}`} defaultValue={value} disabled={busy}
        onChange={(event) => { const fleet = event.target.value; void act(() => setRunnerFleet(runner, fleet === '' ? null : fleet)); }}>
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
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

/** Send again: the same line, for the same repository, to where it first went. */
export function SendAgainButton({ line, repo, target, primary }: { line: string; repo: string; target: Target; primary: boolean }) {
  const { busy, problem, act } = useAct();
  return (
    <span className="runners-action">
      <button type="button" className={primary ? 'runners-ghost is-primary' : 'runners-ghost'} data-primary={primary ? '' : undefined} disabled={busy}
        onClick={() => { void act(() => sendToRunner(line, repo, target)); }}>Send again</button>
      <Problem problem={problem} />
    </span>
  );
}

/** Reads the rows again every 5 s while the tab is visible. Draws nothing. */
export function Refresh() {
  const router = useRouter();
  useEffect(() => poll(() => { router.refresh(); return Promise.resolve(true); }, document, REFRESH_MS), [router]);
  return null;
}
