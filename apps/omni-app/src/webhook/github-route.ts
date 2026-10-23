// `/api/github`'s handlers (PRD 1059): a Vercel function in the web-standard shape (a `Request` in, a
// `Response` out), bound to the groups of the app's environment it needs (../env.ts). It reads the raw
// body — the signature is over the exact bytes — lets `receiveWebhook` verify and filter it, sends the
// resulting events, the fix stamps (PRD 2011 s7) and the main watch's (PRD 2410) among them, on the app's Inngest client, and forwards
// a stage event to galaxy, signed with `STAGE_EVENT_SECRET`, and each touch to galaxy's
// `/api/github/touched`, signed the same way (PRD 902, s3). The webhook secret is `GITHUB_WEBHOOK_SECRET`, required in production; unset
// elsewhere, every delivery is refused (fail closed).
//
// Every delivery, a GET included, writes one `webhook` line (PRD 1723 s6, ../run-log/run-log.ts): its
// outcome and status, the delivery id and the GitHub event's name in `fn`, and, once the signature is
// checked, the repository. A thrown error is logged `failed` and rethrown unchanged.
import { log, type Logger } from 'omni-loop/kit/lib/log/log.ts';
import type { AppEnv } from '../env.ts';
import type { FixStampRequest } from '../fix-rows/fix-stamp.ts';
import type { MainWatchRequest } from '../main-watch/events.ts';
import { type AppEvent, type ApprovedLabelRequest, inngest } from '../inngest-client.ts';
import { forwardStageEvent, stageEventUrl } from '../stage-forward/stage-forward.ts';
import { forwardTouch, touchedUrl } from '../stage-forward/touch.ts';
import { loggedHandler } from '../run-log/run-log.ts';
import { receiveWebhook } from './webhook.ts';

/** The groups the route reads. */
export type GithubRouteEnv = Pick<AppEnv, 'webhook' | 'stageEvents' | 'galaxyUrl'>;

/** The repository a delivery names, `full_name`, or undefined when it names none. */
function repositoryOf(body: string): string | undefined {
  try {
    const parsed: unknown = JSON.parse(body);
    if (typeof parsed !== 'object' || parsed === null || !('repository' in parsed)) return undefined;
    const { repository } = parsed;
    if (typeof repository !== 'object' || repository === null || !('full_name' in repository)) return undefined;
    return typeof repository.full_name === 'string' ? repository.full_name : undefined;
  } catch {
    return undefined;
  }
}

/**
 * `POST` and `GET` of `/api/github`, bound to `env`; `send` is the app's Inngest client's unless given,
 * `logger` the structured logger's.
 */
export function githubRoute(
  env: GithubRouteEnv,
  {
    send = (events: (AppEvent | ApprovedLabelRequest | FixStampRequest | MainWatchRequest)[]) => inngest.send(events),
    logger = log,
  }: { send?: (events: (AppEvent | ApprovedLabelRequest | FixStampRequest | MainWatchRequest)[]) => Promise<unknown>; logger?: Logger } = {},
) {
  const stage = { url: stageEventUrl(env.galaxyUrl), secret: env.stageEvents?.secret };
  const touched = { url: touchedUrl(env.galaxyUrl), secret: env.stageEvents?.secret };
  return {
    POST: loggedHandler(logger, 'webhook', async (request, note) => {
      note({ deliveryId: request.headers.get('x-github-delivery') ?? undefined, fn: request.headers.get('x-github-event') ?? undefined });
      const text = await request.text();
      const { status, body } = await receiveWebhook({
        body: text,
        headers: request.headers,
        secret: env.webhook?.secret,
        send,
        sendApproved: send,
        sendStamps: send,
        sendWatch: send,
        forward: (stageEvent) => forwardStageEvent(stageEvent, stage),
        touch: (touch) => forwardTouch(touch, touched),
      });
      // A delivery whose signature was not checked names no repository in the log.
      if (env.webhook?.secret && status !== 401) note({ repo: repositoryOf(text) });
      return new Response(body, { status, headers: { 'content-type': 'text/plain; charset=utf-8' } });
    }),
    GET: loggedHandler(logger, 'webhook', () => new Response('method not allowed', { status: 405, headers: { allow: 'POST' } })),
  };
}
