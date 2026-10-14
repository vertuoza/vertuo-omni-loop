// Who sent a runner's job (PRD 1830, "The sender"): the runner starts each job with `OMNI_SENT_BY`
// (the sender's GitHub login) and `OMNI_RUNNER` (its own name), and `/omni:pr` writes the line below
// in the body of the pull requests the job opens, through `omni runner sender`. Either unset: no line.

/** `Sent from the Omni app by @<login> on runner <name>`, or `null` when either is missing. */
export function senderLine(sender: { sentBy: string; runner: string } | null): string | null {
  if (!sender) return null;
  const login = sender.sentBy.trim().replace(/^@/, '');
  const runner = sender.runner.trim();
  if (!login || !runner) return null;
  return `Sent from the Omni app by @${login} on runner ${runner}`;
}
