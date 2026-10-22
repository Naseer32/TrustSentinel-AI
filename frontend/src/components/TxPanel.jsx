import { describeError, findContractCode, CONTRACT_ERRORS } from "../lib/errors.js";
import { short } from "../lib/format.js";
import { ErrorBox } from "./ui.jsx";

const STEPS = [
  ["signing", "Confirm in wallet"],
  ["pending", "Submitted, waiting for validators"],
  ["accepted", "Accepted by consensus"],
  ["finalized", "Finalized"],
];

const ORDER = { signing: 0, pending: 1, accepted: 2, finalized: 3 };

function stepState(tx, key) {
  const idx = ORDER[key];
  switch (tx.phase) {
    case "signing": return idx === 0 ? "active" : "todo";
    case "pending": return idx === 0 ? "done" : idx === 1 ? "active" : "todo";
    case "accepted":
    case "unknown":
      if (idx <= 2) return "done";
      return tx.finalized ? "done" : "active";
    case "failed": return idx <= 1 ? "done" : idx === 2 ? "stop" : "todo";
    case "stalled": return idx === 0 ? "done" : idx === 1 ? "stop" : "todo";
    case "error": return tx.hash ? (idx <= 1 ? "done" : "todo") : idx === 0 ? "stop" : "todo";
    default: return "todo";
  }
}

export default function TxPanel({ tx }) {
  if (!tx) return null;
  let error = null;
  if (tx.phase === "error") error = describeError(tx.error);
  if (tx.phase === "stalled") error = { title: describeError(tx.error).title === "The request failed." ? tx.error.message : describeError(tx.error).title, detail: tx.error?.message };
  if (tx.phase === "failed") {
    const code = findContractCode(tx.receiptText || "");
    error = { title: code ? CONTRACT_ERRORS[code] : "The contract rejected this call (execution finished with an error). State was not changed.", detail: tx.receiptText };
  }
  return (
    <section className="card">
      <h2>{tx.label || "Transaction"}</h2>
      <ol className="steps">
        {STEPS.map(([key, text]) => (
          <li key={key} className={"step " + stepState(tx, key)}>{text}</li>
        ))}
      </ol>
      {tx.hash ? <p className="small mono wrap">Hash {short(tx.hash, 10, 8)} <button className="link" onClick={() => navigator.clipboard?.writeText(tx.hash)}>copy</button></p> : null}
      {tx.phase === "unknown" ? <p className="small">Accepted, but the receipt has no execution result field. The result is shown from the contract state below.</p> : null}
      {tx.notice ? <p className="notice">{tx.notice}</p> : null}
      <ErrorBox error={error} />
      {tx.phase === "accepted" && tx.receiptText ? (
        <details><summary className="small">Receipt</summary><pre>{tx.receiptText}</pre></details>
      ) : null}
    </section>
  );
}
