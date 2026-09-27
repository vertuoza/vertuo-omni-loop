// `outbox-check`: the Inngest function wiring the app's units together (PRD 28, "Flow").
//
//   step "in-progress"  create the check run, `in_progress`, on the head SHA
//   step "evaluate"     snapshot into /tmp + evaluate — one step, because /tmp does not survive steps
//   step "publish"      complete the check run; rewrite the comment unless the head moved on
//   step "relay"        send the Omni page the outbox the check read (PRD 251) — only when the base
//                       config turns answers on and its `ask.url` is on `OMNI_PAGE_URL`'s host
//   onFailure           complete the check run as `failure` — never left `in_progress`
//
// The relay runs after the check and the comment are published, and never changes them: a send that
// still fails after its retries is logged, and the run ends as the check concluded. A comment names no
// head, so a run a comment started reads it off the pull request. A pull request closed, merged or
// not, gets the outbox's last send and nothing else: no check run, no comment (`LAST_SEND_TRIGGER`).
//
// Runs are debounced per repository and pull request, so a burst of pushes and label changes is one
// evaluation of the latest state. A snapshot over its bound is not retried: the same bound fails the
// same way, so it goes straight to the failure handler with the bound as its reason.
//
// `createOutboxCheck` takes the Inngest client and `octokitFor(installationId)`, so a test runs the
// real function against a stubbed GitHub; `outboxCheck` is the one the app serves, wired to the app's
// client and to installation tokens signed with the app's private key.
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { App } from '@octokit/app';
import { NonRetriableError } from 'inngest';
import { evaluate } from '../evaluate/evaluate.mjs';
import { inngest, OUTBOX_CHECK_EVENT } from '../inngest-client.mjs';
import { DEFAULT_CHECK_NAME, publish, startCheck } from '../publish/publish.mjs';
import { readOutbox, relayBody, relayTarget, sendOutbox } from '../relay/relay.mjs';
import { SnapshotBoundError, snapshot } from '../snapshot/snapshot.mjs';
import { LAST_SEND_TRIGGER } from '../webhook/webhook.mjs';
import { changedFiles, checkName, completeAsFailure, listComments, readBaseConfig, readPull } from './github.mjs';

export const FUNCTION_ID = 'outbox-check';

/** One evaluation per repository and pull request at a time: the latest event wins. */
export const DEBOUNCE = Object.freeze({
  key: 'event.data.repository + "#" + string(event.data.prNumber)',
  period: '5s',
  timeout: '1m',
});

/**
 * Where the relay sends and how: the App's `OMNI_PAGE_URL` and `OMNI_OUTBOX_SECRET`, read when a run
 * needs them, and the clock that dates an evaluation.
 * @typedef {{ pageUrl?: string, secret?: string, fetch?: typeof fetch, now?: () => string }} RelayDeps
 */
const relayFromEnv = () => ({ pageUrl: process.env.OMNI_PAGE_URL, secret: process.env.OMNI_OUTBOX_SECRET });

/**
 * @param {{
 *   client: import('inngest').Inngest,
 *   octokitFor: (installationId: number) => Promise<{ request: Function }> | { request: Function },
 *   relay?: () => RelayDeps,
 * }} deps
 */
export function createOutboxCheck({ client, octokitFor, relay = relayFromEnv }) {
  return client.createFunction(
    {
      id: FUNCTION_ID,
      name: 'omni-loop · outbox',
      triggers: [{ event: OUTBOX_CHECK_EVENT }],
      debounce: DEBOUNCE,
      retries: 3,
      onFailure: createFailureHandler({ octokitFor }),
    },
    async ({ event, step }) => {
      const { installationId, owner, repo, repository, prNumber, trigger, state } = event.data;
      const sending = relay();
      const now = sending.now ?? (() => new Date().toISOString());

      if (trigger === LAST_SEND_TRIGGER) {
        // The last send: no check run and no comment on a closed pull request, only the page.
        if (!sending.pageUrl) return { relay: 'off' };
        const { outbox } = await step.run('evaluate', async () => {
          const octokit = await octokitFor(installationId);
          return evaluateAt(octokit, { owner, repo, prNumber, headSha: event.data.headSha, pageUrl: sending.pageUrl, now });
        });
        const relayed = await relayStep(step, { sending, repository, prNumber, state, outbox });
        return { relay: relayed };
      }

      const started = await step.run('in-progress', async () => {
        const octokit = await octokitFor(installationId);
        const pull = await readPull(octokit, { owner, repo, prNumber });
        const headSha = event.data.headSha ?? pull.headSha;
        const name = await checkName(octokit, { owner, repo, baseSha: pull.baseSha });
        const checkRunId = await startCheck(octokit, { owner, repo, headSha, name });
        return { checkRunId, name, headSha };
      });
      const headSha = started.headSha;

      const { verdict, outbox } = await step.run('evaluate', async () => {
        const octokit = await octokitFor(installationId);
        try {
          return await evaluateAt(octokit, { owner, repo, prNumber, headSha, pageUrl: sending.pageUrl, now });
        } catch (error) {
          if (error instanceof SnapshotBoundError) throw new NonRetriableError(error.message, { cause: error });
          throw error;
        }
      });

      const published = await step.run('publish', async () => {
        const octokit = await octokitFor(installationId);
        return publish(octokit, {
          owner,
          repo,
          checkRunId: started.checkRunId,
          pullNumber: prNumber,
          headSha,
          verdict,
        });
      });

      const relayed = await relayStep(step, { sending, repository, prNumber, state: 'open', outbox });
      return {
        checkRunId: started.checkRunId,
        name: started.name,
        conclusion: verdict.conclusion,
        ...published,
        ...(relayed === 'none' ? {} : { relay: relayed }),
      };
    },
  );
}

/**
 * The step "relay": sends the outbox the evaluation read, when it read one. A send the page refuses
 * throws inside the step, so Inngest retries it; once the retries are spent the error is logged here
 * and the run carries on — the check and the comment are already published and stay as they are.
 * @returns {Promise<'none' | { sent: true, status: number, url: string | null } | { sent: false, error: string }>}
 */
async function relayStep(step, { sending, repository, prNumber, state, outbox }) {
  if (!outbox) return 'none';
  try {
    const sent = await step.run('relay', () =>
      sendOutbox({
        fetch: sending.fetch,
        origin: outbox.origin,
        secret: sending.secret,
        body: relayBody({
          repository,
          pr: { number: prNumber, headSha: outbox.headSha, state },
          evaluatedAt: outbox.evaluatedAt,
          outbox: outbox.read,
        }),
      }),
    );
    return { sent: true, ...sent };
  } catch (error) {
    const reason = error?.message ?? String(error);
    console.error(`omni-loop relay: ${repository}#${prNumber} was not sent to the Omni page: ${reason}`);
    return { sent: false, error: reason };
  }
}

/**
 * The step "evaluate": snapshot the base branch's config and the head's delivery folder into /tmp,
 * gather the pull request's facts, comments and changed files, and let `evaluate` decide. When the
 * base config sends this repository's outbox to the page (`relayTarget`), it also reads the outbox
 * the relay sends, from the same folders and comments, while they are still there. The temporary
 * folders are removed whatever happens.
 * @returns {Promise<{ verdict: object, outbox: null | { origin: string, headSha: string, evaluatedAt: string, read: object } }>}
 */
async function evaluateAt(octokit, { owner, repo, prNumber, headSha, pageUrl = null, now = () => new Date().toISOString() }) {
  const pr = await readPull(octokit, { owner, repo, prNumber });
  const base = mkdtempSync(join(tmpdir(), 'omni-base-'));
  const head = mkdtempSync(join(tmpdir(), 'omni-head-'));
  try {
    const { config } = await readBaseConfig(octokit, { owner, repo, baseSha: pr.baseSha, dest: base });

    let comments = [];
    let changes = null;
    if (config) {
      await snapshot(octokit, { owner, repo, ref: headSha, paths: [config.paths.delivery], dest: head });
      comments = await listComments(octokit, { owner, repo, prNumber });
      changes = await changedFiles(octokit, { owner, repo, baseSha: pr.baseSha, headSha });
    }

    const facts = { baseRef: pr.baseRef, headRef: pr.headRef, headSha, labels: pr.labels };
    const evaluatedAt = now();
    const verdict = evaluate({ base, head, pr: facts, changes, comments, now: () => evaluatedAt });

    const origin = relayTarget({ config, pageUrl });
    const read = origin ? readOutbox({ head, config, pr: facts, comments, commentBody: verdict.comment?.body ?? null }) : null;
    return { verdict, outbox: read ? { origin, headSha, evaluatedAt, read } : null };
  } finally {
    rmSync(base, { recursive: true, force: true });
    rmSync(head, { recursive: true, force: true });
  }
}

/**
 * The failure handler: once the run has failed after its retries, complete the check as `failure`
 * with the reason ("omni-loop could not evaluate: …"). Inngest hands it the original event under
 * `event.data.event` and the final error.
 */
export function createFailureHandler({ octokitFor }) {
  return async ({ event, error, step }) => {
    const original = event.data.event;
    const { installationId, owner, repo, prNumber, trigger } = original.data;
    // The last send made no check run: there is none to fail.
    if (trigger === LAST_SEND_TRIGGER) return { checkRunIds: [], name: null, reason: 'the last send failed' };
    const reason = error?.message ?? event.data.error?.message ?? 'unknown error';

    const run = (id, fn) => (step?.run ? step.run(id, fn) : fn());
    return run('complete-as-failure', async () => {
      const octokit = await octokitFor(installationId);
      let name = DEFAULT_CHECK_NAME;
      let headSha = original.data.headSha;
      try {
        const pull = await readPull(octokit, { owner, repo, prNumber });
        headSha ??= pull.headSha;
        name = await checkName(octokit, { owner, repo, baseSha: pull.baseSha });
      } catch {
        // The failure may be GitHub itself: fall back to the default name rather than fail twice.
      }
      if (!headSha) return { checkRunIds: [], name, reason };
      const checkRunIds = await completeAsFailure(octokit, { owner, repo, headSha, name, reason });
      return { checkRunIds, name, reason };
    });
  };
}

/**
 * An installation's Octokit, signed with the app's private key (`GITHUB_APP_ID`,
 * `GITHUB_APP_PRIVATE_KEY`). A key pasted with literal `\n` sequences is accepted.
 */
let app;
export function installationOctokit(installationId) {
  app ??= new App({
    appId: requiredEnv('GITHUB_APP_ID'),
    privateKey: requiredEnv('GITHUB_APP_PRIVATE_KEY').replace(/\\n/g, '\n'),
  });
  return app.getInstallationOctokit(installationId);
}

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set.`);
  return value;
}

export const outboxCheck = createOutboxCheck({ client: inngest, octokitFor: installationOctokit });
