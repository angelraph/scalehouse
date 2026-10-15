/** Message the house owner signs to name a wallet. Shared by the client and /api/labels. */
export const labelMessage = (houseId: number, address: string, label: string) =>
  `Scalehouse: in house #${houseId}, call ${address.toLowerCase()} "${label}"`;
