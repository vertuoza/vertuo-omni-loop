export default {
  test: {
    include: ['game/**/*.test.mjs', 'kit/**/*.test.mjs', 'packages/**/*.test.mjs', 'apps/omni-app/**/*.test.mjs'],
    exclude: ['**/node_modules/**'],
  },
};
