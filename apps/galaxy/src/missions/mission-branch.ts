/** The branch a mission's PRDs sit on, as `branches.mission` shapes it: `mission/<number>-<topic>`, the topic its title's words. */
export function missionBranch(mission: { number: number; title: string }): string {
  const topic = mission.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+/, '').slice(0, 40).replace(/-+$/, '');
  return `mission/${String(mission.number)}-${topic}`;
}
