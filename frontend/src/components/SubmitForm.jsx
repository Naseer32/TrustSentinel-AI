import { useEffect, useMemo, useState } from "react";
import { CHAINS, RULES } from "../lib/rules.js";
import { validateClaimForm } from "../lib/validate.js";
import { Field } from "./ui.jsx";

export default function SubmitForm({ canWrite, busy, nonce, nonceError, onReloadNonce, onSubmit, existingId, onOpenExisting, onPrecheck }) {
  const [v, setV] = useState({ chain: "ethereum", subject: "", claim_type: "ownership_renounced", claim_text: "", evidence_url: "", nonce: "" });
  const [touched, setTouched] = useState(false);
  const errors = useMemo(() => validateClaimForm({ ...v, nonce: v.nonce === "" ? String(nonce ?? "") : v.nonce }), [v, nonce]);
  const set = (k) => (e) => setV((s) => ({ ...s, [k]: e.target.value }));
  const effectiveNonce = v.nonce === "" ? nonce : v.nonce;
  const hasNonce = effectiveNonce !== null && effectiveNonce !== undefined && effectiveNonce !== "";
  const valid = Object.keys(errors).length === 0 && hasNonce;
  const rule = RULES[v.claim_type];

  // Real find_claim call once the form is valid, to warn about duplicates before spending a transaction.
  useEffect(() => {
    if (Object.keys(errors).length === 0) onPrecheck({ chain: v.chain, subject: v.subject, claim_type: v.claim_type, evidence_url: v.evidence_url });
  }, [v.chain, v.subject, v.claim_type, v.evidence_url]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <form className="card stack" onSubmit={(e) => { e.preventDefault(); setTouched(true); if (valid && canWrite) onSubmit({ ...v, nonce: String(effectiveNonce) }); }}>
      <h2>Submit a claim</h2>
      <Field label="Chain" error={touched && errors.chain}>
        <select value={v.chain} onChange={set("chain")}>{CHAINS.map((c) => <option key={c}>{c}</option>)}</select>
      </Field>
      <Field label="Subject address" hint={v.chain === "solana" ? "Base58 address" : "0x followed by 40 hex characters"} error={(touched || v.subject) && errors.subject}>
        <input value={v.subject} onChange={set("subject")} autoCapitalize="off" autoCorrect="off" spellCheck="false" placeholder="0x..." />
      </Field>
      <Field label="Claim type" hint={rule ? rule.factKey + " " + rule.rule : ""} error={touched && errors.claim_type}>
        <select value={v.claim_type} onChange={set("claim_type")}>
          {Object.entries(RULES).map(([k, r]) => <option key={k} value={k}>{r.label}</option>)}
        </select>
      </Field>
      <Field label="Claim text" hint={v.claim_text.trim().length + "/280 (min 8)"} error={(touched || v.claim_text) && errors.claim_text}>
        <textarea rows={3} value={v.claim_text} onChange={set("claim_text")} placeholder="What does the project claim?" />
      </Field>
      <Field label="Evidence URL (https)" hint="The domain must be on the contract's allow-list (set by the owner)." error={(touched || v.evidence_url) && errors.evidence_url}>
        <input value={v.evidence_url} onChange={set("evidence_url")} inputMode="url" autoCapitalize="off" autoCorrect="off" spellCheck="false" placeholder="https://..." />
      </Field>
      <Field label="Nonce" hint={nonceError ? "Could not read your nonce automatically. Enter it manually (your count of submitted claims)." : "Read from the contract for your wallet address."} error={touched && errors.nonce}>
        <div className="row">
          <input value={v.nonce === "" ? (nonce ?? "") : v.nonce} onChange={set("nonce")} inputMode="numeric" />
          <button type="button" className="btn small-btn" onClick={() => { setV((s) => ({ ...s, nonce: "" })); onReloadNonce(); }}>Reload</button>
        </div>
      </Field>
      {existingId ? (
        <p className="notice">A claim with these details already exists: #{existingId}. <button type="button" className="link" onClick={() => onOpenExisting(existingId)}>Open it</button></p>
      ) : null}
      <button className="btn primary" type="submit" disabled={!canWrite || busy || !!existingId}>{busy ? "Working..." : "Submit claim"}</button>
      {!canWrite ? <p className="small muted">Connect a wallet on the right network to submit.</p> : null}
    </form>
  );
}
