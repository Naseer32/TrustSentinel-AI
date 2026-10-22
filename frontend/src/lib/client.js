import { createClient } from "genlayer-js";
import { NETWORKS } from "./networks.js";

// Read client: talks to the GenLayer RPC directly, no wallet needed.
export function makeReadClient(networkKey) {
  return createClient({ chain: NETWORKS[networkKey].chain });
}

// Write client: transactions are signed by the browser wallet (window.ethereum).
export function makeWriteClient(networkKey, address) {
  return createClient({ chain: NETWORKS[networkKey].chain, account: address, provider: window.ethereum });
}

export function expectedChainId(networkKey) {
  const id = NETWORKS[networkKey]?.chain?.id;
  return typeof id === "number" ? id : null;
}

// Switches (or adds) the wallet network. client.connect(name) is documented in the genlayer-js README.
export async function switchWalletNetwork(networkKey, address) {
  const client = makeWriteClient(networkKey, address);
  await client.connect(networkKey);
}
