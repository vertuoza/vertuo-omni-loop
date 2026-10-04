// The arcade's server modules carry `import 'server-only'` (PRD 1066): inside Next, the server resolves
// the marker under the `react-server` condition, to an empty module, and a client import of one fails
// the build. Plain Node resolves it to the module that throws. A script that loads the server's
// modules registers this hook first, then imports them dynamically (a static import is resolved before
// any of the script runs), so Node resolves the marker as the server does.
import { registerHooks } from 'node:module';

registerHooks({
  resolve: (specifier, context, nextResolve) =>
    nextResolve(specifier, specifier === 'server-only' ? { ...context, conditions: [...context.conditions, 'react-server'] } : context),
});
