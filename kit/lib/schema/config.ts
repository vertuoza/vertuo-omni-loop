// The shape of `.omni-loop/config.yml` (PRD 725, s3), beside the kit's other schemas. It is defined
// in `kit/lib/config.ts`, which reads the file through it, because its defaults are the only
// repository literals the kit may carry, and `kit/test/no-literals.test.ts` allows them in that one
// file (ADR-0047). The `Config` type in `kit/lib/types.ts` is what it parses to.
export { ConfigSchema } from '../config.ts';
