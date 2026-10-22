// Chain objects and network names come from genlayer-js (README: "Available networks").
import { localnet, studionet, testnetAsimov, testnetBradbury } from "genlayer-js/chains";

export const NETWORKS = {
  studionet: { label: "GenLayer Studio (studionet)", chain: studionet },
  localnet: { label: "Local simulator (localnet)", chain: localnet },
  testnetAsimov: { label: "Testnet Asimov", chain: testnetAsimov },
  testnetBradbury: { label: "Testnet Bradbury", chain: testnetBradbury },
};

export function networkKeyOrDefault(key) {
  return Object.prototype.hasOwnProperty.call(NETWORKS, key) ? key : "studionet";
}
