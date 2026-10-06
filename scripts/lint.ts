// `pnpm lint` (PRD 976): the linter over the repository, failing on any finding at all
// (scripts/lint-repository.ts). `pnpm lint <prefix>…` lints only the tracked files under those
// prefixes, the same way: quicker, when a change touches one folder.
import { lintRepository } from './lint-repository.ts';

const { exitCode, report } = await lintRepository(process.argv.slice(2));
(exitCode === 0 ? process.stdout : process.stderr).write(report);
process.exitCode = exitCode;
