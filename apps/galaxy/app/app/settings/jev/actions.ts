'use server';
import { saveDecisionFor, type DecisionSaved } from '../../../../src/jev/settings/decision';
import { signedInStore } from '../../../../src/jev/settings/live';
import type { JevDecisionSettings } from '../../../../src/jev/store';

// Settings › Jev's server action (PRD 812 s2): one decision's mode, threshold and confidence floor,
// saved as the signed-in person, so set_jev_decision() decides who may (the owner) and what (a mode
// other than Off only with a key). Nothing else moves. src/jev/settings/decision.ts holds the rules.

export async function saveJevDecision(workspace: string, settings: JevDecisionSettings): Promise<DecisionSaved> {
  return saveDecisionFor(await signedInStore(), workspace, settings);
}
