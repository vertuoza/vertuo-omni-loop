// Who sent a runner's job (PRD 1830, "The sender"): the runner starts each job with `OMNI_SENT_BY`
// (the sender's GitHub login) and `OMNI_RUNNER` (its own name), and `/omni:pr` writes the line below
// in the body of the pull requests the job opens, through `omni runner sender`. Either unset: no line.
//
// A job an API key sent (PRD 2433) has `OMNI_SENT_BY_KEY`, the key's name, in place of the login, and
// its line names the key: no `@`, no login, so the pull request mentions no one.

/** Who sent a job: the person's login, or the API key's name, and the runner it runs on. */
export type Sender = { sentBy?: string | null; sentByKey?: string | null; runner: string };

/** A key's name on one line, with no `@` (which would mention a login), or `null` when nothing is left. */
function keyName(name: string): string | null {
  const text = name.replace(/@/g, '').replace(/\s+/g, ' ').trim();
  return text === '' ? null : text;
}

/**
 * `Sent from the Omni app by @<login> on runner <name>`, or, for a key's job,
 * `Sent through the Omni API by API key <name> on runner <name>`; `null` when the sender or the runner is missing.
 */
export function senderLine(sender: Sender | null): string | null {
  if (!sender) return null;
  const runner = sender.runner.trim();
  if (!runner) return null;
  if (sender.sentByKey !== undefined && sender.sentByKey !== null) {
    const key = keyName(sender.sentByKey);
    return key === null ? null : `Sent through the Omni API by API key ${key} on runner ${runner}`;
  }
  const login = (sender.sentBy ?? '').trim().replace(/^@/, '');
  if (!login) return null;
  return `Sent from the Omni app by @${login} on runner ${runner}`;
}
