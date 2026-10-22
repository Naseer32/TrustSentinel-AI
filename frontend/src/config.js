export const CONTRACT_ADDRESS = (import.meta.env.VITE_CONTRACT_ADDRESS || "").trim();
export const DEFAULT_NETWORK = (import.meta.env.VITE_GENLAYER_NETWORK || "studionet").trim();
export const ADDRESS_OK = /^0x[0-9a-fA-F]{40}$/.test(CONTRACT_ADDRESS);
