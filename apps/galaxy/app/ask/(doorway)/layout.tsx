import { Doorway } from '../../../src/doorway/Doorway';

// The two terminal sign-ins, /ask/signin (PRD 71) and /ask/device (PRD 1660), in the doorway
// (PRD 1705): someone arriving from a terminal's link has one card to read and one button to press,
// and no part of the app around it.

export default function AskDoorwayLayout({ children }: { children: React.ReactNode }) {
  return <Doorway>{children}</Doorway>;
}
