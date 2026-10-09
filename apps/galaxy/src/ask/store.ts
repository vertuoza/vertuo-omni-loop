// The ask store's old path (PRD 1318, s3): the rows and their rules live in rows.ts, the queries in
// ask.repository.ts. Kept for the areas that still import from here (the dossier page's shares, the
// dashboard's counts) until their own PRD moves them; it holds no query of its own.
export * from './rows';
export { askAttachments, askCategories, askShares, askStore, type AskAttachmentFiles, type AskCategories, type AskShares, type AskStore } from './ask.repository';
