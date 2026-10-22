import { useCallback, useEffect, useState } from "react";
import { expectedChainId, switchWalletNetwork } from "../lib/client.js";

// Browser-wallet connection using the standard EIP-1193 provider (window.ethereum).
export function useWallet(networkKey) {
  const [address, setAddress] = useState("");
  const [chainId, setChainId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const hasWallet = typeof window !== "undefined" && !!window.ethereum;

  const readChain = useCallback(async () => {
    try {
      const hex = await window.ethereum.request({ method: "eth_chainId" });
      setChainId(parseInt(hex, 16));
    } catch {
      setChainId(null);
    }
  }, []);

  useEffect(() => {
    if (!hasWallet) return undefined;
    const onAccounts = (accts) => setAddress(accts && accts[0] ? accts[0] : "");
    const onChain = (hex) => setChainId(parseInt(hex, 16));
    window.ethereum.request({ method: "eth_accounts" }).then(onAccounts).catch(() => {});
    readChain();
    window.ethereum.on?.("accountsChanged", onAccounts);
    window.ethereum.on?.("chainChanged", onChain);
    return () => {
      window.ethereum.removeListener?.("accountsChanged", onAccounts);
      window.ethereum.removeListener?.("chainChanged", onChain);
    };
  }, [hasWallet, readChain]);

  const connect = useCallback(async () => {
    setError(null);
    if (!hasWallet) {
      setError(new Error("No browser wallet found. Open this page in a wallet app's browser (for example MetaMask) or install a wallet extension."));
      return;
    }
    setBusy(true);
    try {
      const accts = await window.ethereum.request({ method: "eth_requestAccounts" });
      const a = accts && accts[0] ? accts[0] : "";
      setAddress(a);
      if (a) await switchWalletNetwork(networkKey, a);
      await readChain();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }, [hasWallet, networkKey, readChain]);

  const switchNetwork = useCallback(async () => {
    if (!address) return;
    setError(null);
    setBusy(true);
    try {
      await switchWalletNetwork(networkKey, address);
      await readChain();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }, [address, networkKey, readChain]);

  const want = expectedChainId(networkKey);
  const networkOk = !address ? null : want === null || chainId === null ? null : chainId === want;
  return { hasWallet, address, chainId, networkOk, busy, error, connect, switchNetwork };
}
