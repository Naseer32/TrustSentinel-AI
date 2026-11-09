// Chain objects and network names come from genlayer-js (README: "Available networks").
import { localnet, studionet, testnetAsimov, testnetBradbury } from "genlayer-js/chains";

// Hosted "Studio Dev" environment: like studionet, but its own chain id and RPC.
const studioDev = {
  ...studionet,
  id: 61997,
  name: "GenLayer Studio Dev",
  rpcUrls: { ...studionet.rpcUrls, default: { http: ["https://studio-dev.genlayer.com/api"] } },
};

export const NETWORKS = {
  studioDev: { label: "GenLayer Studio Dev", chain: studioDev },
  studionet: { label: "GenLayer Studio (studionet)", chain: studionet },
  localnet: { label: "Local simulator (localnet)", chain: localnet },
  testnetAsimov: { label: "Testnet Asimov", chain: testnetAsimov },
  testnetBradbury: { label: "Testnet Bradbury", chain: testnetBradbury },
};

export function networkKeyOrDefault(key) {
  return Object.prototype.hasOwnProperty.call(NETWORKS, key) ? key : "studionet";
}
