import { useState } from "react";
import { CHAINS, RULES } from "../lib/rules.js";
import { validateClaimForm } from "../lib/validate.js";
import { Field } from "./ui.jsx";

export default function LookupPanel({ onLoad, onFind, loading }) {
  const [id, setId] = useState("");
  const [f, setF] = useState({ chain: "ethereum", subject: "", claim_type: "ownership_renounced", evidence_url: "" });
  const [err, setErr] = useState("");
  const idOk = /^[1-9][0-9]*$/.test(id);
  return (
    <section className="card stack">
      <h2>Look up a claim</h2>
      <form className="row" onSubmit={(e) => { e.preventDefault(); if (idOk) onLoad(Number(id)); }}>
        <input value={id} onChange={(e) => setId(e.target.value.trim())} inputMode="numeric" placeholder="Claim id, e.g. 1" aria-label="Claim id" />
        <button className="btn primary" disabled={!idOk || loading}>{loading ? "..." : "Load"}</button>
      </form>
      <details>
        <summary>Find by details</summary>
        <form className="stack" onSubmit={(e) => {
          e.preventDefault();
          const errors = validateClaimForm({ ...f, claim_text: "placeholder text", nonce: "0" });
          delete errors.claim_text;
          const first = Object.values(errors)[0];
          if (first) { setErr(first); return; }
          setErr("");
          onFind(f);
        }}>
          <Field label="Chain"><select value={f.chain} onChange={(e) => setF({ ...f, chain: e.target.value })}>{CHAINS.map((c) => <option key={c}>{c}</option>)}</select></Field>
          <Field label="Subject address"><input value={f.subject} onChange={(e) => setF({ ...f, subject: e.target.value.trim() })} spellCheck="false" autoCapitalize="off" /></Field>
          <Field label="Claim type"><select value={f.claim_type} onChange={(e) => setF({ ...f, claim_type: e.target.value })}>{Object.entries(RULES).map(([k, r]) => <option key={k} value={k}>{r.label}</option>)}</select></Field>
          <Field label="Evidence URL"><input value={f.evidence_url} onChange={(e) => setF({ ...f, evidence_url: e.target.value.trim() })} inputMode="url" spellCheck="false" autoCapitalize="off" /></Field>
          {err ? <p className="field-error">{err}</p> : null}
          <button className="btn" disabled={loading}>Find claim</button>
        </form>
      </details>
    </section>
  );
}
