// Whether this deployment may send from the Outbox tab (PRD 251, s11): it knows the omni-loop App's
// client (GITHUB_APP_CLIENT_ID and GITHUB_APP_CLIENT_SECRET, both server-only) and has its database.
// Reads only the environment it is given, so the tab asks it without the server's clients.

export function sendOpen(env: Record<string, string | undefined> = process.env): boolean {
  return Boolean(
    env.GITHUB_APP_CLIENT_ID?.trim() && env.GITHUB_APP_CLIENT_SECRET?.trim()
      && env.NEXT_PUBLIC_SUPABASE_URL && env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}
