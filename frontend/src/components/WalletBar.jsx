import { NETWORKS } from "../lib/networks.js";
import { short } from "../lib/format.js";
import { describeError } from "../lib/errors.js";
import { ErrorBox } from "./ui.jsx";

export default function WalletBar({ wallet, network, onNetwork, reach, contract }) {
  const err = wallet.error ? describeError(wallet.error) : null;
  return (
    <section className="card wallet">
      <div className="row between">
        <h1>TrustSentinel <span className="muted">AI</span></h1>
        <span className={"dot " + (reach.state === "ok" ? "dot-ok" : reach.state === "error" ? "dot-bad" : "dot-wait")} title={reach.state} />
      </div>
      <label className="field">
        <span className="field-label">Network</span>
        <select value={network} onChange={(e) => onNetwork(e.target.value)}>
          {Object.entries(NETWORKS).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>
      </label>
      <p className="small mono">Contract {short(contract, 8, 6)}</p>
      <p className="small">
        {reach.state === "ok" ? "Contract reachable on this network (read-only call succeeded)." : null}
        {reach.state === "checking" ? "Checking the contract..." : null}
        {reach.state === "error" ? "Contract not reachable on this network: " + reach.message : null}
      </p>
      {wallet.address ? (
        <div className="stack">
          <p className="small mono">Wallet {short(wallet.address, 8, 6)}</p>
          {wallet.networkOk === false ? (
            <button className="btn warn" disabled={wallet.busy} onClick={wallet.switchNetwork}>
              {wallet.busy ? "Switching..." : "Wallet is on another network. Switch network"}
            </button>
          ) : (
            <p className="small">{wallet.networkOk ? "Wallet network matches." : "Wallet network could not be compared."}</p>
          )}
        </div>
      ) : (
        <div className="stack">
          <button className="btn primary" disabled={wallet.busy} onClick={wallet.connect}>
            {wallet.busy ? "Connecting..." : "Connect wallet"}
          </button>
          <p className="small muted">Reading claims works without a wallet. Wallet is only needed to submit or verify.</p>
        </div>
      )}
      <ErrorBox error={err} />
    </section>
  );
}
