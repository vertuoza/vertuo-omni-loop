/**
 * **OmniMan signs the loop's work** (PRD #99).
 *
 * The lines the loop signs with, built from the `signature` config section (`kit/lib/config.mjs`),
 * and the questions asked of what GitHub holds: is a body signed, does a commit message carry the
 * trailer, and which bot account an address belongs to. `omni sign` prints the lines, `omni phase0`
 * checks a phase-0 branch's commits, and `omni credits` counts what was signed.
 *
 * A `signature` of `null` means signing is off: no line is built and nothing carries the trailer.
 *
 * Pure: no filesystem, no network, no clock.
 */

/** The hidden marker a signed body carries after its footer, whatever the footer's wording. */
export const SIGNED_MARKER = '<!-- omni-loop:signed -->';

/** A GitHub noreply address: `<id>+<login>@…`, or the older `<login>@…` with no id. */
const NOREPLY = /^(?:\d+\+)?([^\s@+]+)@users\.noreply\.github\.com$/i;

/**
 * The co-author line a commit the loop makes ends with, or `null` when signing is off.
 *
 * @param {{ name: string, email: string } | null} signature
 * @returns {string | null}
 */
export function trailerLine(signature) {
  return signature ? `Co-authored-by: ${signature.name} <${signature.email}>` : null;
}

/** The placeholders a footer may hold (PRD #215): each is filled with the signature key it names. */
const PLACEHOLDER = /\{(name|home)\}/g;

/**
 * The line a pull request or issue body the loop opens ends with — the footer, then the marker — or
 * `null` when signing is off. The footer is a template: every `{name}` is filled with the
 * signature's name and every `{home}` with its home page, once each, so a value holding a
 * placeholder is printed as it is. Anything else, an unknown `{…}` included, is printed as written.
 *
 * @param {{ name?: string, home?: string, footer: string } | null} signature
 * @returns {string | null}
 */
export function footerLine(signature) {
  if (!signature) return null;
  const footer = signature.footer.replace(PLACEHOLDER, (placeholder, key) =>
    typeof signature[key] === 'string' ? signature[key] : placeholder,
  );
  return `${footer} ${SIGNED_MARKER}`;
}

/** Whether a pull request or issue body carries the marker. */
export function isSignedBody(body) {
  return typeof body === 'string' && body.includes(SIGNED_MARKER);
}

/**
 * Whether a commit message has a line that is exactly the signature's trailer: another name or
 * another address is not his, and neither is the trailer quoted inside a longer line. Trailing
 * spaces and a carriage return are ignored. Always `false` when signing is off.
 *
 * @param {string | null | undefined} message
 * @param {{ name: string, email: string } | null} signature
 */
export function carriesTrailer(message, signature) {
  const trailer = trailerLine(signature);
  if (trailer === null || typeof message !== 'string') return false;
  return message.split('\n').some((line) => line.trimEnd() === trailer);
}

/**
 * The GitHub login a noreply address belongs to — `omni-loop-invader[bot]` in
 * `333776611+omni-loop-invader[bot]@users.noreply.github.com` — or `null` for any other address.
 *
 * @param {string | null | undefined} email
 * @returns {string | null}
 */
export function botLogin(email) {
  const match = typeof email === 'string' ? NOREPLY.exec(email.trim()) : null;
  return match ? match[1] : null;
}
