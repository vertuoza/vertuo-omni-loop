// `/api/github`'s handlers (PRD 1059): a Vercel function in the web-standard shape (a `Request` in, a
// `Response` out), bound to the groups of the app's environment it needs (../env.ts). It reads the raw
// body — the signature is over the exact bytes — lets `receiveWebhook` verify and filter it, sends the
// resulting events on the app's Inngest client, and forwards a stage event to galaxy, signed with
// `STAGE_EVENT_SECRET`. The webhook secret is `GITHUB_WEBHOOK_SECRET`, required in production; unset
// elsewhere, every delivery is refused (fail closed).
import type { AppEnv } from '../env.ts';
import { type AppEvent, inngest } from '../inngest-client.ts';
import { forwardStageEvent, stageEventUrl } from '../stage-forward/stage-forward.ts';
import { receiveWebhook } from './webhook.ts';

/** The groups the route reads. */
export type GithubRouteEnv = Pick<AppEnv, 'webhook' | 'stageEvents' | 'galaxyUrl'>;

/** `POST` and `GET` of `/api/github`, bound to `env`; `send` is the app's Inngest client's unless given. */
export function githubRoute(env: GithubRouteEnv, { send = (events: AppEvent[]) => inngest.send(events) }: { send?: (events: AppEvent[]) => Promise<unknown> } = {}) {
  const stage = { url: stageEventUrl(env.galaxyUrl), secret: env.stageEvents?.secret };
  return {
    async POST(request: Request): Promise<Response> {
      const { status, body } = await receiveWebhook({
        body: await request.text(),
        headers: request.headers,
        secret: env.webhook?.secret,
        send,
        forward: (stageEvent) => forwardStageEvent(stageEvent, stage),
      });
      return new Response(body, { status, headers: { 'content-type': 'text/plain; charset=utf-8' } });
    },
    GET(): Response {
      return new Response('method not allowed', { status: 405, headers: { allow: 'POST' } });
    },
  };
}
