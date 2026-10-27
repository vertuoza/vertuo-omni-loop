# Bug 2528: attaching a GitHub App to an API key fails, as checkApp reads GET /users/<slug>[bot] with the App's JWT

## Triage

- **Domain:** Public API keys, a key's GitHub App (PRD 2433): `checkApp` in `apps/galaxy/src/public-api/keys/github-app.ts`
- **Risk:** high — every owner who attaches a GitHub App to an API key is told GitHub could not be reached, for any valid pair, so no key can hold an App and no job runs as the caller's own App; there is no workaround. (Jev, 0.93)
- **Regression:** new bug — no evidence this ever worked

## Reproduction

- **File:** `apps/galaxy/src/public-api/keys/github-app.test.ts`
- **Level:** unit (`checkApp` on a stubbed GitHub that, like GitHub, refuses the App's JWT off the App's own routes)
- **Red:** AssertionError: expected { ok: false, …(2) } to deeply equal { ok: true, slug: 'acme-bugs', …(1) }, received `"detail": "GitHub answered 401 to GET /users/acme-bugs[bot]"`, `"reason": "unavailable"`

## Fix

`checkApp` read the bot's id from `GET /users/<slug>[bot]` with the App's JWT, as it read `GET /app`.
GitHub takes an App's JWT on the App's own routes only, so that call never answered ok, and every
attach ended `unavailable`: "GitHub could not be reached to check this App". The bot's route is public:
it is now asked with no token, its `accept` and API version headers kept. `GET /app` keeps the JWT, so a
pair GitHub does not know is still refused.

Asked with no token rather than with an installation token: it is spec §2's own call, its real answer
was seen in the report (`200`, the bot's id), and it attaches an App that is not installed yet, which
the spec allows (the installation is checked at send, §4); an installation token would refuse that App
and mint a token at every attach. Its cost: GitHub's anonymous rate limit (60 an hour per address,
shared on Vercel). An attach is a rare owner action, and a rate-limited answer stays `unavailable`, so
the owner tries again; the log names the status.

Which status GitHub gave the JWT in production stays unconfirmed: the Vercel logs were not read.

## Guard

The stubbed GitHub in `github-app.test.ts` now refuses the App's JWT on any route that is not the App's
own (`/app…`, `/repos/{owner}/{repo}/installation`), as GitHub does, with its own test; and a test pins
that the bot lookup carries no `authorization` header and no trace of the JWT. On `main`'s `checkApp`
three tests fail; on the fix all pass.

## Mutation

mutation: no changed core file against origin/main (05954f57): nothing to mutate
