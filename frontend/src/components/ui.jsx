import { VERDICTS } from "../lib/rules.js";

export function Badge({ verdict }) {
  const info = VERDICTS[verdict];
  return <span className={"badge tone-" + (info ? info.tone : "neutral")}>{verdict}</span>;
}

export function Chip({ children }) {
  return <span className="chip">{children}</span>;
}

export function RiskMeter({ score }) {
  const n = Math.max(0, Math.min(100, Number(score) || 0));
  const tone = n >= 60 ? "bad" : n >= 25 ? "warn" : "good";
  return (
    <div className="risk" role="img" aria-label={"Risk indicator score " + n + " out of 100"}>
      <div className="risk-bar"><div className={"risk-fill tone-" + tone} style={{ width: n + "%" }} /></div>
      <div className="risk-num">{n}/100</div>
    </div>
  );
}

export function Field({ label, hint, error, children }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
      {hint && !error ? <span className="field-hint">{hint}</span> : null}
      {error ? <span className="field-error">{error}</span> : null}
    </label>
  );
}

export function ErrorBox({ error }) {
  if (!error) return null;
  return (
    <div className="errbox" role="alert">
      <strong>{error.title}</strong>
      {error.detail && error.detail !== error.title ? (
        <details>
          <summary>Technical details</summary>
          <pre>{error.detail}</pre>
        </details>
      ) : null}
    </div>
  );
}
