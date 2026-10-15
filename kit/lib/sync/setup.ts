// The newcomer's setup facts (PRD 1990, spec section 3): the Omni plugin and the HUD plugin
// installed, and this computer signed in to the Omni page; the fourth step, `main` pulled, is the
// main check's. Not gathered yet: every step reads as done until this file gathers them.
import { HUD_PLUGIN } from '../init/settings.ts';
import { MARKETPLACE, PLUGIN } from '../init/steps.ts';
import type { Gatherer, SetupFacts } from './facts.ts';

export const setupFacts: Gatherer<SetupFacts> = () =>
  Promise.resolve({
    claude: true,
    plugin: { done: true, fix: `/plugin install ${PLUGIN}@${MARKETPLACE}` },
    hud: { done: true, fix: `/plugin install ${HUD_PLUGIN}` },
    signedIn: true,
  });
