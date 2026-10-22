import { useCallback, useEffect, useMemo, useState } from "react";
import { ADDRESS_OK, CONTRACT_ADDRESS, DEFAULT_NETWORK } from "./config.js";
import { NETWORKS, networkKeyOrDefault } from "./lib/networks.js";
import { makeReadClient, makeWriteClient } from "./lib/client.js";
import { claimArgs, executeWrite, findClaim, getClaim, getHistory, getNonce, probeContract } from "./lib/contract.js";
import { describeError } from "./lib/errors.js";
import { VERDICTS } from "./lib/rules.js";
import { useWallet } from "./hooks/useWallet.js";
import WalletBar from "./components/WalletBar.jsx";
import LookupPanel from "./components/LookupPanel.jsx";
import SubmitForm from "./components/SubmitForm.jsx";
import ClaimView from "./components/ClaimView.jsx";
import TxPanel from "./components/TxPanel.jsx";
import { ErrorBox } from "./components/ui.jsx";

function ConfigError() {
  return (
    <main className="app">
      <section className="card">
        <h1>Configuration missing</h1>
        <p>
          <code>VITE_CONTRACT_ADDRESS</code> is not set to a valid address (0x followed by 40 hex characters).
          Copy <code>.env.example</code> to <code>.env</code>, set the address, and restart the dev server.
        </p>
      </section>
    </main>
  );
}

function hashClaimId() {
  const m = /^#claim=([1-9][0-9]*)$/.exec(window.location.hash);
  return m ? Number(m[1]) : null;
}

function Main() {
  const [network, setNetworkState] = useState(() => {
    let saved = null;
    try { saved = window.localStorage.getItem("ts.network"); } catch { /* storage may be blocked */ }
    return networkKeyOrDefault(saved || DEFAULT_NETWORK);
  });
  const [tab, setTab] = useState("check");
  const [reach, setReach] = useState({ state: "checking", message: "" });
  const [claim, setClaim] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [claimError, setClaimError] = useState(null);
  const [tx, setTx] = useState(null);
  const [busy, setBusy] = useState(false);
  const [nonce, setNonce] = useState(null);
  const [nonceError, setNonceError] = useState(false);
  const [existingId, setExistingId] = useState(0);
  const [nowMs, setNowMs] = useState(Date.now());

  const wallet = useWallet(network);
  const readClient = useMemo(() => makeReadClient(network), [network]);
  const canWrite = wallet.hasWallet && !!wallet.address && wallet.networkOk !== false;

  const setNetwork = (k) => {
    setNetworkState(k);
    try { window.localStorage.setItem("ts.network", k); } catch { /* ignore */ }
    setClaim(null); setHistory([]); setTx(null); setClaimError(null);
  };

  useEffect(() => {
    const t = setInterval(() => setNowMs(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    let alive = true;
    setReach({ state: "checking", message: "" });
    probeContract(readClient, CONTRACT_ADDRESS)
      .then(() => alive && setReach({ state: "ok", message: "" }))
      .catch((e) => alive && setReach({ state: "error", message: describeError(e).detail.slice(0, 200) }));
    return () => { alive = false; };
  }, [readClient]);

  const loadClaim = useCallback(async (id) => {
    setLoading(true); setClaimError(null);
    try {
      const [c, h] = await Promise.all([getClaim(readClient, CONTRACT_ADDRESS, id), getHistory(readClient, CONTRACT_ADDRESS, id, 20)]);
      setClaim(c); setHistory(h); setTab("check");
      window.history.replaceState(null, "", "#claim=" + id);
      return { claim: c, history: h };
    } catch (e) {
      setClaim(null); setHistory([]);
      setClaimError(describeError(e));
      return null;
    } finally {
      setLoading(false);
    }
  }, [readClient]);

  useEffect(() => {
    const id = hashClaimId();
    if (id) loadClaim(id);
  }, [loadClaim]);

  const findAndLoad = async (f) => {
    setLoading(true); setClaimError(null);
    try {
      const id = await findClaim(readClient, CONTRACT_ADDRESS, f);
      if (id === 0) { setClaim(null); setClaimError({ title: "No claim exists with those details.", detail: "" }); setLoading(false); return; }
      await loadClaim(id);
    } catch (e) {
      setClaimError(describeError(e)); setLoading(false);
    }
  };

  const reloadNonce = useCallback(async () => {
    if (!wallet.address) { setNonce(null); return; }
    try {
      setNonce(await getNonce(readClient, CONTRACT_ADDRESS, wallet.address));
      setNonceError(false);
    } catch {
      setNonce(null); setNonceError(true);
    }
  }, [readClient, wallet.address]);

  useEffect(() => { reloadNonce(); }, [reloadNonce]);

  const precheck = useCallback(async (f) => {
    try { setExistingId(await findClaim(readClient, CONTRACT_ADDRESS, f)); } catch { setExistingId(0); }
  }, [readClient]);

  const runTx = async (label, functionName, args, after) => {
    setBusy(true);
    setTx({ label, phase: "signing", hash: null, finalized: false });
    try {
      const writeClient = makeWriteClient(network, wallet.address);
      const res = await executeWrite(
        { writeClient, readClient, address: CONTRACT_ADDRESS, functionName, args },
        (u) => setTx((t) => ({ ...t, label, ...u })),
      );
      if (res.ok || res.unknown) {
        try {
          await after();
        } catch (e) {
          setTx((t) => ({ ...t, notice: "The transaction was accepted, but refreshing from the contract failed: " + describeError(e).detail }));
        }
      }
    } catch (e) {
      setTx((t) => ({ ...(t || {}), label, phase: "error", error: e }));
    } finally {
      setBusy(false);
    }
  };

  const submit = (values) =>
    runTx("Submit claim", "submit_claim", claimArgs(values), async () => {
      const id = await findClaim(readClient, CONTRACT_ADDRESS, values);
      reloadNonce();
      if (id > 0) {
        await loadClaim(id);
        setTx((t) => ({ ...t, notice: "Claim #" + id + " was created. Open the Check tab to verify it." }));
      } else {
        setTx((t) => ({ ...t, notice: "The transaction was accepted but the claim is not visible yet. Try Find by details in a moment." }));
      }
    });

  const verify = () => {
    const before = history.length ? history[0].index : -1;
    return runTx("Verify claim #" + claim.claim_id, "verify_claim", [claim.claim_id], async () => {
      const r = await loadClaim(claim.claim_id);
      const top = r && r.history[0];
      if (top && top.index > before && top.action === "check_failed") {
        setTx((t) => ({ ...t, notice: "The evidence page could not be checked, so the verdict was kept. " + top.detail }));
      } else if (r) {
        setTx((t) => ({ ...t, notice: "Result: " + r.claim.status + ". " + (VERDICTS[r.claim.status]?.text || "") }));
      }
    });
  };

  const expire = () => runTx("Mark claim #" + claim.claim_id + " expired", "mark_expired", [claim.claim_id], async () => { await loadClaim(claim.claim_id); });

  return (
    <main className="app">
      <WalletBar wallet={wallet} network={network} onNetwork={setNetwork} reach={reach} contract={CONTRACT_ADDRESS} />
      <nav className="tabs" aria-label="Sections">
        {[["check", "Check"], ["submit", "Submit"], ["help", "Help"]].map(([k, t]) => (
          <button key={k} className={"tab" + (tab === k ? " on" : "")} onClick={() => setTab(k)}>{t}</button>
        ))}
      </nav>

      {tab === "check" ? (
        <>
          <LookupPanel onLoad={loadClaim} onFind={findAndLoad} loading={loading} />
          {loading ? <p className="center muted">Loading from the contract...</p> : null}
          <ErrorBox error={claimError} />
          {claim && !loading ? (
            <>
              <ClaimView claim={claim} history={history} canWrite={canWrite} busy={busy} onVerify={verify} onExpire={expire} nowMs={nowMs} />
              <button className="btn" onClick={() => loadClaim(claim.claim_id)}>Refresh from contract</button>
            </>
          ) : null}
          <TxPanel tx={tx} />
        </>
      ) : null}

      {tab === "submit" ? (
        <>
          <SubmitForm
            canWrite={canWrite} busy={busy} nonce={nonce} nonceError={nonceError} onReloadNonce={reloadNonce}
            onSubmit={submit} existingId={existingId} onPrecheck={precheck}
            onOpenExisting={(id) => loadClaim(id)}
          />
          <TxPanel tx={tx} />
        </>
      ) : null}

      {tab === "help" ? (
        <section className="card stack">
          <h2>How to read results</h2>
          {Object.entries(VERDICTS).map(([k, v]) => (<p key={k}><strong>{k}</strong>: {v.text}</p>))}
          <p className="small">Everything on screen is read from, or sent to, the contract at <span className="mono">{CONTRACT_ADDRESS}</span> on <strong>{NETWORKS[network].label}</strong>. Nothing is simulated.</p>
          <p className="small">Reads use the <em>accepted</em> state, which can be newer than finalized state.</p>
          <p className="small">Admin actions (allow-list, collectors, pause, ownership) and attested evidence are not in this app on purpose; use Studio for those.</p>
        </section>
      ) : null}
    </main>
  );
}

export default function App() {
  return ADDRESS_OK ? <Main /> : <ConfigError />;
}
