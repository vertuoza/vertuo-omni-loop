// A Virtual Fleet's tabs (PRD 2842 s6, the `fleet-frame` screen): Operation room · Missions · Heroes · Board,
// chosen by `?tab=`, the Operation room when it names none. An ordinary fleet has no tabs: its board, as
// before.

export const FLEET_TABS = [
  { id: 'room', label: 'Operation room' },
  { id: 'missions', label: 'Missions' },
  { id: 'heroes', label: 'Heroes' },
  { id: 'board', label: 'Board' },
] as const;

export type FleetTab = (typeof FLEET_TABS)[number]['id'];

/** The tab `?tab=` names, the Operation room when it names none of them. */
export function tabOf(asked: string | string[] | undefined): FleetTab {
  const value = Array.isArray(asked) ? asked[0] : asked;
  return FLEET_TABS.find((tab) => tab.id === value)?.id ?? 'room';
}
