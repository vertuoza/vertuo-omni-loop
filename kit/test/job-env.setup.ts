// The suite also runs inside a runner job, whose environment would otherwise reach every test and every
// child process (#2618). A job running as a GitHub App names the bot as git's author and committer
// (`githubAppVariables`, PRD 2433), which git prefers to a fixture repository's own `user.email`, and
// it carries the job's own `OMNI_TOKEN` and `OMNI_GITHUB_APP`, which change what `omni` signs in as and
// who it works for. Tests set up the identity they test. This deletes rather than stubs, so a test file's
// `vi.unstubAllEnvs()` cannot bring the job's values back.
delete process.env.GIT_AUTHOR_NAME;
delete process.env.GIT_AUTHOR_EMAIL;
delete process.env.GIT_COMMITTER_NAME;
delete process.env.GIT_COMMITTER_EMAIL;
delete process.env.OMNI_TOKEN;
delete process.env.OMNI_GITHUB_APP;
