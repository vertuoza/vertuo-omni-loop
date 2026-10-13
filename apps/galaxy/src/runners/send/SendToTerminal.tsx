'use client';
import { createContext, useContext, useId, useState, type ReactNode } from 'react';
import { sendToRunner } from '../runners.client';
import { jobHref, queuedWords, sendable, type SendOption, type SendSetup } from './targets';

// Send to terminal (PRD 1830 s4): beside every button that copies an `/omni:` line a runner runs (Build it,
// the PR care, User voice and Pitch panes' copy buttons, a concept's), a button that opens a small picker
// of the targets the viewer may send to (./targets.ts): Any runner, each fleet, each runner with its
// state, then Send, its one primary action. Once sent, the picker gives way to `Queued for <target>` and
// a link to the job on the Runners page; a refusal from the route shows its reason in the same place.
// A page gives it its runners through SendToTerminalScope, read on the server (./send.live.ts): with no
// scope, no runner the viewer may use, or a line off the list, nothing is drawn and the head is as it was.

/** Where the button stands: closed, its picker open (a choice made, maybe sending), queued, or refused. */
export type SendState =
  | { kind: 'closed' }
  | { kind: 'open'; choice: string; sending: boolean }
  | { kind: 'queued'; words: string; href: string }
  | { kind: 'refused'; error: string };

const PICK_FIRST = 'Pick where to send it.';

const SendContext = createContext<SendSetup | null>(null);

/** Gives Send to terminal the page's repository and the viewer's targets; null, or none, hides it. */
export function SendToTerminalScope({ setup, children }: { setup: SendSetup | null; children: ReactNode }) {
  return <SendContext value={setup}>{children}</SendContext>;
}

/** Queues `line` for the page's repository to the option chosen, and says where it went or why not. */
export async function sendTo(line: string, setup: SendSetup, choice: string, fetcher: typeof fetch = fetch): Promise<SendState> {
  const option = setup.options.find((o) => o.key === choice);
  if (!option) return { kind: 'refused', error: PICK_FIRST };
  const sent = await sendToRunner(line, setup.repo, option.target, fetcher);
  return sent.ok ? { kind: 'queued', words: queuedWords(option), href: jobHref(sent.value.id) } : { kind: 'refused', error: sent.error };
}

const GROUPS: readonly { group: SendOption['group']; heading: string | null }[] = [
  { group: 'any', heading: null },
  { group: 'fleet', heading: 'Fleets' },
  { group: 'runner', heading: 'Runners' },
];

function Choice({ option, name, checked, onChoose }: { option: SendOption; name: string; checked: boolean; onChoose: (key: string) => void }) {
  return (
    <label className="send-choice">
      <input type="radio" name={name} value={option.key} checked={checked} onChange={() => { onChoose(option.key); }} />
      {option.label}{option.state && <> <span className="send-state">{option.state}</span></>}
    </label>
  );
}

/** The button, its picker and what it says, as drawn for one state; nothing when it has no place here. */
export function SendToTerminalView({ line, setup, state, name, onToggle, onChoose, onSend }: {
  line: string; setup: SendSetup | null; state: SendState; name: string;
  onToggle: () => void; onChoose: (key: string) => void; onSend: () => void;
}) {
  if (!setup || setup.options.length === 0 || !sendable(line)) return null;
  const open = state.kind === 'open' ? state : null;
  return (
    <span className="send-terminal">
      <button type="button" className="ask-button quiet" aria-expanded={open !== null} onClick={onToggle}>Send to terminal</button>
      {open && (
        <div className="send-pick" role="group" aria-label="Send to terminal">
          {GROUPS.map(({ group, heading }) => {
            const options = setup.options.filter((o) => o.group === group);
            if (options.length === 0) return null;
            return (
              <fieldset key={group} className="send-choices" disabled={open.sending}>
                {heading && <legend className="ask-hint">{heading}</legend>}
                {options.map((o) => <Choice key={o.key} option={o} name={name} checked={o.key === open.choice} onChoose={onChoose} />)}
              </fieldset>
            );
          })}
          <button type="button" className="ask-button stage-action" data-primary="true" disabled={open.sending} onClick={onSend}>
            {open.sending ? 'Sending…' : 'Send'}
          </button>
        </div>
      )}
      {state.kind === 'queued' && <span className="ask-hint" role="status">{state.words} · <a href={state.href}>View job</a></span>}
      {state.kind === 'refused' && <span className="ask-problem" role="alert">{state.error}</span>}
    </span>
  );
}

/** Send to terminal for `line`, with the targets its page gives it. */
export function SendToTerminal({ line }: { line: string }) {
  const setup = useContext(SendContext);
  const name = useId();
  const [state, setState] = useState<SendState>({ kind: 'closed' });
  const first = setup?.options[0]?.key ?? '';

  function toggle() {
    setState(state.kind === 'open' ? { kind: 'closed' } : { kind: 'open', choice: first, sending: false });
  }

  function choose(key: string) {
    if (state.kind === 'open') setState({ ...state, choice: key });
  }

  async function send() {
    if (state.kind !== 'open' || !setup) return;
    setState({ ...state, sending: true });
    setState(await sendTo(line, setup, state.choice));
  }

  return <SendToTerminalView line={line} setup={setup} state={state} name={name} onToggle={toggle} onChoose={choose} onSend={() => void send()} />;
}
