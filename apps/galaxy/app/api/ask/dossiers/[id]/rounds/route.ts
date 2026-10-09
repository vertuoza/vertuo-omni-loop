// GET /api/ask/dossiers/:id/rounds → {rounds}: which of a dossier's rounds are open, in the order asked,
// read by /ask/q/<round> once its answer is sent, to go back to the next one (PRD 384; PRD 1318, s3;
// src/ask/ask.controller.ts).
export { getDossierRounds as GET } from '../../../../../../src/ask/ask.controller';
