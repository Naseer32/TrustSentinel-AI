import { CHAINS, RULES } from "./rules.js";

const BAD = new Set("\u200b\u200c\u200d\u200e\u200f\u202a\u202b\u202c\u202d\u202e\u2066\u2067\u2068\u2069\ufeff\u00ad".split(""));

export function normalizeText(s) {
  return String(s).replace(/\s+/g, " ").trim();
}

export function hasHiddenChars(s) {
  for (const ch of s) {
    const o = ch.codePointAt(0);
    if (o < 32 || o === 127 || BAD.has(ch)) return true;
  }
  return false;
}

export function validateSubject(chain, subject) {
  if (chain === "solana") return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(subject) ? null : "Invalid Solana address.";
  return /^0x[0-9a-fA-F]{40}$/.test(subject) ? null : "EVM address must be 0x followed by 40 hex characters.";
}

export function validateUrl(url) {
  if (typeof url !== "string" || url.length < 12 || url.length > 512) return "URL must be 12-512 characters.";
  if (/[\s\\]/.test(url) || /[^\x21-\x7e]/.test(url)) return "URL must be printable ASCII without spaces.";
  if (!/^https:\/\//i.test(url)) return "Only https:// URLs are allowed.";
  const auth = url.slice(8).split(/[/?#]/, 1)[0];
  if (auth.includes("@")) return "User info in URLs is not allowed.";
  const host = auth.includes(":") ? auth.slice(0, auth.lastIndexOf(":")) : auth;
  const port = auth.includes(":") ? auth.slice(auth.lastIndexOf(":") + 1) : "443";
  if (port !== "443") return "Only the default https port is allowed.";
  if (/^[0-9.]+$/.test(host) || !/^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$/i.test(host)) {
    return "The host must be a plain DNS name (no IP addresses).";
  }
  if (/xn--/i.test(host)) return "Punycode hosts are not allowed.";
  return null;
}

/** Mirrors the contract's input checks so users do not pay for transactions that are sure to fail. */
export function validateClaimForm(v) {
  const errors = {};
  if (!CHAINS.includes(v.chain)) errors.chain = "Choose a supported chain.";
  else {
    const e = validateSubject(v.chain, v.subject || "");
    if (e) errors.subject = e;
  }
  if (!Object.prototype.hasOwnProperty.call(RULES, v.claim_type)) errors.claim_type = "Choose a claim type.";
  const text = normalizeText(v.claim_text || "");
  if (hasHiddenChars(text)) errors.claim_text = "Text contains control or invisible characters.";
  else if (text.length < 8 || text.length > 280) errors.claim_text = "Claim text must be 8-280 characters.";
  const ue = validateUrl(v.evidence_url || "");
  if (ue) errors.evidence_url = ue;
  if (v.nonce !== "" && v.nonce !== undefined && !/^[0-9]+$/.test(String(v.nonce))) errors.nonce = "Nonce must be a whole number.";
  return errors;
}
