// The one shape a function takes its GitHub client by: `octokitFor(installationId)`, so a test hands a
// stubbed client and the app hands an installation's. `Client` is the part of Octokit the function calls.

/** An installation's GitHub client, for its id. */
export type OctokitFor<Client> = (installationId: number) => Promise<Client> | Client;
