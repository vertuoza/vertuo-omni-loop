// Sharing a live question (PRD 144): the link a teammate opens, whom the owner may pick, and copying
// the link — to the clipboard, or, where the browser refuses, by selecting it for the person to copy.
import { memberLabel } from '../store';
import type { Face } from '../../people/face';
import { faceOfMember, type Member } from './question';

/** Where a shared round is answered: /ask/q/<round>, on the host the page was opened on. */
export const shareLink = (origin: string, roundId: string) => `${origin.replace(/\/+$/, '')}/ask/q/${roundId}`;

/** Whom the owner may share with: every other member of the session's workspace. */
export function shareCandidates(members: Member[], owner: string): Array<{ id: string; label: string; face: Face }> {
  return members.filter((m) => m.user_id !== owner).map((m) => {
    const label = memberLabel(m);
    return { id: m.user_id, label, face: faceOfMember(m.user_id, members, label) };
  });
}

/** Copies the link; `selected` when the clipboard is missing or refuses, and the text was selected instead. */
export async function copyLink(
  link: string,
  clipboard: { writeText(text: string): Promise<void> } | undefined,
  select: () => void,
): Promise<'copied' | 'selected'> {
  try {
    if (!clipboard) throw new Error('no clipboard');
    await clipboard.writeText(link);
    return 'copied';
  } catch {
    select();
    return 'selected';
  }
}
