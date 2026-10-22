import { Badge, Chip, RiskMeter } from "./ui.jsx";
import { ACTIONS, COOLDOWN_SECONDS, INDICATORS, PROVENANCE, RULES, VERDICTS } from "../lib/rules.js";
import { cooldownRemaining, fmtAgo, fmtTime, isHttps, short } from "../lib/format.js";

function Row({ k, children }) {
  return (
    <div className="kv">
      <div className="k">{k}</div>
      <div className="v">{children}</div>
    </div>
  );
}

export default function ClaimView({ claim, history, canWrite, busy, onVerify, onExpire, nowMs }) {
  const rule = RULES[claim.claim_type];
  const info = VERDICTS[claim.status];
  const remaining = cooldownRemaining(claim.last_check, COOLDOWN_SECONDS, nowMs);
  const canMark = claim.status === "EXPIRED" && claim.stored_verdict !== "EXPIRED";
  return (
    <div className="stack">
      <section className="card">
        <div className="row between">
          <h2>Claim #{claim.claim_id}</h2>
          <Badge verdict={claim.status} />
        </div>
        {info ? <p>{info.text}</p> : null}
        {claim.stored_verdict !== claim.status ? <p className="small">Stored verdict: {claim.stored_verdict} (status is derived from the clock).</p> : null}
        <p className="claim-text">{claim.claim_text}</p>
        <Row k="Type">{rule ? rule.label : claim.claim_type}</Row>
        {rule ? <Row k="Rule"><span className="mono">{rule.factKey}</span> {rule.rule}</Row> : null}
        <Row k="Chain">{claim.chain}</Row>
        <Row k="Subject"><span className="mono wrap">{claim.subject}</span></Row>
        <Row k="Submitted by"><span className="mono">{short(claim.submitter, 8, 6)}</span></Row>
        <Row k="Submitted">{fmtTime(claim.created_at)}</Row>
      </section>

      <section className="card">
        <h3>Risk indicators</h3>
        <RiskMeter score={claim.risk_score} />
        <p className="small muted">A triage signal built from the indicators below. It is not a probability of fraud.</p>
        {claim.indicators.length ? (
          <ul className="indicators">
            {claim.indicators.map((i) => (
              <li key={i}><Chip>{i}</Chip><span className="small">{INDICATORS[i] || "Reported by the contract."}</span></li>
            ))}
          </ul>
        ) : <p className="small">No indicators.</p>}
      </section>

      <section className="card">
        <h3>Evidence</h3>
        <Row k="Provenance">{PROVENANCE[claim.provenance] || claim.provenance}</Row>
        <Row k="Source">
          {isHttps(claim.source || claim.evidence_url)
            ? <a className="wrap" href={claim.source || claim.evidence_url} target="_blank" rel="noopener noreferrer">{claim.source || claim.evidence_url}</a>
            : <span className="wrap">{claim.source || claim.evidence_url}</span>}
        </Row>
        {claim.snippet ? <blockquote>{claim.snippet}</blockquote> : <p className="small">No grounded quote recorded.</p>}
        <Row k="Evidence key"><span className="mono wrap small">{claim.evidence_key || "-"}</span></Row>
        <Row k="Recorded by"><span className="mono">{claim.provenance === "none" ? "-" : short(claim.actor, 8, 6)}</span></Row>
        <Row k="Verdict time">{fmtTime(claim.verdict_at)} <span className="muted small">{fmtAgo(claim.verdict_at, nowMs)}</span></Row>
        <Row k="Expires">{fmtTime(claim.expires_at)} <span className="muted small">{fmtAgo(claim.expires_at, nowMs)}</span></Row>
        <Row k="Checks">{claim.checks}</Row>
      </section>

      <section className="card">
        <h3>Actions</h3>
        <button className="btn primary" disabled={!canWrite || busy} onClick={onVerify}>
          {busy ? "Working..." : "Verify now"}
        </button>
        {remaining > 0 ? <p className="small">Cooldown: about {Math.ceil(remaining / 60)} min left. The contract will reject earlier checks.</p> : null}
        {canMark ? <button className="btn" disabled={!canWrite || busy} onClick={onExpire}>Mark as expired on-chain</button> : null}
        {!canWrite ? <p className="small muted">Connect a wallet on the right network to send transactions.</p> : null}
      </section>

      <section className="card">
        <h3>Audit history</h3>
        {history.length ? (
          <ol className="timeline">
            {history.map((e) => (
              <li key={e.index}>
                <div className="row between"><strong>{ACTIONS[e.action] || e.action}</strong><span className="small muted">#{e.index}</span></div>
                <div className="small">{fmtTime(e.at)} <span className="muted">{fmtAgo(e.at, nowMs)}</span></div>
                {e.verdict ? <div className="small">Verdict: {e.verdict}</div> : null}
                {e.detail ? <div className="small mono wrap">{e.detail}</div> : null}
                <div className="small muted mono">by {short(e.actor, 8, 6)}</div>
              </li>
            ))}
          </ol>
        ) : <p className="small">No history entries.</p>}
        <p className="small muted">Newest first, up to 20 entries.</p>
      </section>
    </div>
  );
}
