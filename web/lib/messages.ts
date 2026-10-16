/** Message the house owner signs to name a wallet. Shared by the client and /api/labels. */
export const labelMessage = (houseId: number, address: string, label: string) =>
  `Scalehouse: in house #${houseId}, call ${address.toLowerCase()} "${label}"`;

/** Message the house owner signs to add or list link confirmers. Shared by the client and /api/confirmers. */
export const confirmersMessage = (houseId: number, chainId: number, action: string, at: number) =>
  `Scalehouse: ${action} link confirmers for house #${houseId} on chain ${chainId}.\nTime: ${at}`;
