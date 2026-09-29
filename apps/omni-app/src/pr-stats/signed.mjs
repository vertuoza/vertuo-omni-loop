// Who a pull request is by, as the Engineering board counts it (PRD 612): a bot, and whether Omni-man
// signed it. Pure: no network, no clock.
//
// Omni-man signed a pull request when any one of three things holds: one of its commits carries a
// co-author trailer with Omni-man's e-mail (the e-mail is the key, whatever the name), its body carries
// the footer marker, or `omni-loop-invader[bot]` opened it. His identity is the kit's default
// signature, the one every repository running the loop signs with.
import { parseConfig } from 'vertuo-omni-plan/kit/lib/config.mjs';
import { botLogin, isSignedBody } from 'vertuo-omni-plan/kit/lib/signature.mjs';

/** Omni-man's signature: the kit's default. */
export const SIGNATURE = parseConfig('kit: 1\n').signature;

/** The GitHub login of the bot account behind Omni-man's e-mail: `omni-loop-invader[bot]`. */
export const OMNI_LOGIN = botLogin(SIGNATURE.email);

const TRAILER = /^co-authored-by:.*<([^>]+)>$/i;

/** Whether a commit message has a co-author trailer line with Omni-man's e-mail. */
function carriesOmniTrailer(message) {
  if (typeof message !== 'string') return false;
  const email = SIGNATURE.email.toLowerCase();
  return message.split('\n').some((line) => TRAILER.exec(line.trim())?.[1].trim().toLowerCase() === email);
}

/**
 * @param {{ author: string | null | undefined, body: string | null | undefined, commitMessages: string[] | undefined }} pull
 */
export function isOmniSigned({ author, body, commitMessages }) {
  return author === OMNI_LOGIN || isSignedBody(body) || (commitMessages ?? []).some(carriesOmniTrailer);
}

/** A bot account: a login ending in `[bot]`, or GitHub's `type: Bot`. */
export function isBot(user) {
  if (!user) return false;
  return user.type === 'Bot' || (typeof user.login === 'string' && user.login.endsWith('[bot]'));
}
