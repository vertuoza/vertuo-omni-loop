// `outbox-check`: the Inngest function wiring the app's units together (PRD 28, "Flow").
//
//   step "in-progress"  create the check run, `in_progress`, on the head SHA — unless the base branch
//                       has no `.omni-loop/config.yml`: then the run ends there, and nothing is posted;
//                       or unless the pull request is not an Omni Loop feature PR: then the check is
//                       posted already `skipped`, and the run ends there (issue 876)
//   step "evaluate"     snapshot into /tmp + evaluate — one step, because /tmp does not survive steps
//   step "publish"      complete the check run; rewrite the comment unless the head moved on
//   onFailure           complete the check run as `failure` — never left `in_progress`; on a pull
//                       request that is not an Omni Loop feature PR, `skipped` instead, never `failure`;
//                       on a repository without the loop's config, nothing
//
// Runs are debounced per repository and pull request, so a burst of pushes and label changes is one
// evaluation of the latest state. A snapshot over its bound is not retried: the same bound fails the
// same way, so it goes straight to the failure handler with the bound as its reason.
//
// The app is public (PRD 359): it is installed on repositories that never asked for the loop, so a
// repository without the loop's config gets no check run and no comment, not even a `skipped` one.
//
// `createOutboxCheck` takes the Inngest client and `octokitFor(installationId)`, so a test runs the
// real function against a stubbed GitHub; `outboxCheck` is the one the app serves, wired to the app's
// client and to installation tokens signed with the app's private key.
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { App } from '@octokit/app';
import { NonRetriableError } from 'inngest';
import { NOT_ACTIVE_ON_REPO, evaluate } from '../evaluate/evaluate.mjs';
import { inngest, OUTBOX_CHECK_EVENT } from '../inngest-client.mjs';
import { DEFAULT_CHECK_NAME, publish, startCheck } from '../publish/publish.mjs';
import { SnapshotBoundError, snapshot } from '../snapshot/snapshot.mjs';
import { changedFiles, checkTarget, completeAsFailure, completeAsSkipped, listComments, readBaseConfig, readPull } from './github.mjs';

export const FUNCTION_ID = 'outbox-check';

/** What a run returns when it posted nothing: the repository has not installed the loop. */
const SILENT = Object.freeze({ posted: false, reason: NOT_ACTIVE_ON_REPO });

/** Why the failure handler posted nothing: GitHub could not say whether the gate runs on this pull request. */
const UNKNOWN_PR = 'omni-loop could not tell whether this is an Omni Loop feature PR';

/** One evaluation per repository and pull request at a time: the latest event wins. */
export const DEBOUNCE = Object.freeze({
  key: 'event.data.repository + "#" + string(event.data.prNumber)',
  period: '5s',
  timeout: '1m',
});

/**
 * @param {{
 *   client: import('inngest').Inngest,
 *   octokitFor: (installationId: number) => Promise<{ request: Function }> | { request: Function },
 * }} deps
 */
export function createOutboxCheck({ client, octokitFor }) {
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
      const { installationId, owner, repo, prNumber, headSha } = event.data;

      const started = await step.run('in-progress', async () => {
        const octokit = await octokitFor(installationId);
        const { active, name, gated, reason } = await checkTarget(octokit, { owner, repo, prNumber, headSha });
        if (!active) return null;
        if (!gated) {
          const [checkRunId] = await completeAsSkipped(octokit, { owner, repo, headSha, name, reason });
          return { checkRunId, name, skipped: true };
        }
        const checkRunId = await startCheck(octokit, { owner, repo, headSha, name });
        return { checkRunId, name };
      });
      if (!started) return { ...SILENT };
      if (started.skipped) return { checkRunId: started.checkRunId, name: started.name, conclusion: 'skipped' };

      const verdict = await step.run('evaluate', async () => {
        const octokit = await octokitFor(installationId);
        try {
          return await evaluateAt(octokit, { owner, repo, prNumber, headSha });
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

      return { checkRunId: started.checkRunId, name: started.name, conclusion: verdict.conclusion, ...published };
    },
  );
}

/**
 * The step "evaluate": snapshot the base branch's config and the head's delivery folder into /tmp,
 * gather the pull request's facts, comments and changed files, and let `evaluate` decide. The
 * temporary folders are removed whatever happens.
 */
async function evaluateAt(octokit, { owner, repo, prNumber, headSha }) {
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

    return evaluate({
      base,
      head,
      pr: { baseRef: pr.baseRef, headRef: pr.headRef, headSha, labels: pr.labels },
      changes,
      comments,
    });
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
    const { installationId, owner, repo, prNumber, headSha } = original.data;
    const reason = error?.message ?? event.data.error?.message ?? 'unknown error';

    const run = (id, fn) => (step?.run ? step.run(id, fn) : fn());
    return run('complete-as-failure', async () => {
      const octokit = await octokitFor(installationId);
      let target = null;
      try {
        target = await checkTarget(octokit, { owner, repo, prNumber, headSha });
      } catch {
        // The failure may be GitHub itself: what the pull request is stays unknown.
      }
      if (target && !target.active) return { ...SILENT };
      if (target && !target.gated) {
        const checkRunIds = await completeAsSkipped(octokit, { owner, repo, headSha, name: target.name, reason: target.reason });
        return { checkRunIds, name: target.name, conclusion: 'skipped' };
      }
      // Gated, or unknown: an open check run of this name was started by step "in-progress", on a gated
      // pull request only, so failing it is safe. A new failed check is created only once the pull
      // request is known to be gated: never red on one that is not (issue 876).
      if (target) {
        const checkRunIds = await completeAsFailure(octokit, { owner, repo, headSha, name: target.name, reason });
        return { checkRunIds, name: target.name, reason };
      }
      const name = DEFAULT_CHECK_NAME;
      let checkRunIds = [];
      try {
        checkRunIds = await completeAsFailure(octokit, { owner, repo, headSha, name, reason, createWhenNone: false });
      } catch {
        // GitHub still refuses: there is nothing this handler can safely write.
      }
      if (checkRunIds.length === 0) return { posted: false, reason: UNKNOWN_PR };
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
