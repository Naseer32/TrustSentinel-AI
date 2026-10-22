// genlayer-js returns decoded calldata: dicts may be Map, ints may be bigint.
// This converts any such value into plain JSON-friendly JS. It never invents data.

export function plain(v) {
  if (v === null || v === undefined) return v;
  if (typeof v === "bigint") {
    return v <= BigInt(Number.MAX_SAFE_INTEGER) && v >= -BigInt(Number.MAX_SAFE_INTEGER) ? Number(v) : v.toString();
  }
  if (v instanceof Map) {
    const o = {};
    for (const [k, val] of v.entries()) o[String(k)] = plain(val);
    return o;
  }
  if (Array.isArray(v)) return v.map(plain);
  if (v instanceof Uint8Array) return "0x" + Array.from(v, (b) => b.toString(16).padStart(2, "0")).join("");
  if (typeof v === "object") {
    if (Object.getPrototypeOf(v) === Object.prototype || Object.getPrototypeOf(v) === null) {
      const o = {};
      for (const k of Object.keys(v)) o[k] = plain(v[k]);
      return o;
    }
    return String(v);
  }
  return v;
}

const CLAIM_FIELDS = [
  "claim_id", "chain", "subject", "claim_type", "claim_text", "evidence_url", "submitter", "created_at",
  "stored_verdict", "status", "verdict_at", "expires_at", "provenance", "evidence_key", "observed_at",
  "source", "actor", "snippet", "indicators", "risk_score", "checks", "last_check",
];

/** Validates the shape of get_claim output. Throws with the missing fields instead of guessing. */
export function parseClaim(raw) {
  const c = plain(raw);
  if (!c || typeof c !== "object" || Array.isArray(c)) {
    throw new Error("Unexpected get_claim response (not an object).");
  }
  const missing = CLAIM_FIELDS.filter((f) => !(f in c));
  if (missing.length) throw new Error("get_claim response is missing fields: " + missing.join(", "));
  if (!Array.isArray(c.indicators)) throw new Error("get_claim.indicators is not a list.");
  return c;
}

export function parseHistory(raw) {
  const h = plain(raw);
  if (!Array.isArray(h)) throw new Error("Unexpected get_history response (not a list).");
  return h.map((e) => {
    for (const f of ["index", "action", "actor", "at", "verdict", "detail"]) {
      if (!(f in e)) throw new Error("get_history entry is missing field: " + f);
    }
    return e;
  });
}

export function toInt(raw, label = "value") {
  const v = plain(raw);
  if (typeof v === "number" && Number.isInteger(v)) return v;
  if (typeof v === "string" && /^[0-9]+$/.test(v)) return Number(v);
  throw new Error("Unexpected " + label + " response: " + JSON.stringify(v));
}

export function safeJson(obj) {
  return JSON.stringify(obj, (_k, v) => (typeof v === "bigint" ? v.toString() : v instanceof Map ? Object.fromEntries(v) : v), 2);
}
