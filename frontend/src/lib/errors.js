// Contract errors are raised as "<code>: <message>" (see _fail in the contract).

export const CONTRACT_ERRORS = {
  not_owner: "Only the contract owner can do this.",
  paused: "The contract is paused by its owner.",
  bad_claim_id: "The claim id must be a whole number.",
  unknown_claim: "That claim does not exist.",
  bad_nonce: "The nonce is out of date. Reload the nonce and try again.",
  bad_input: "One of the text fields has an invalid length or forbidden characters.",
  bad_chain: "That chain is not supported.",
  bad_subject: "The subject address is not valid for that chain.",
  bad_claim_type: "That claim type is not supported.",
  bad_url: "The evidence URL is not acceptable (https only, a DNS host, no spaces, 512 characters max).",
  domain_not_allowed: "The evidence URL's domain is not on the contract's allow-list. Only the owner can add domains.",
  sender_limit: "This account reached the per-sender claim limit.",
  duplicate_claim: "A claim with the same chain, subject, type and URL already exists.",
  cooldown: "This claim was checked too recently. Wait for the cooldown to pass.",
  not_expired: "This claim is not expired (or is already marked expired).",
  not_collector: "Only authorised collectors can do this.",
};

const CODE_RE = new RegExp("\\b(" + Object.keys(CONTRACT_ERRORS).join("|") + ")\\s*:");

export function findContractCode(text) {
  if (typeof text !== "string") return null;
  const m = CODE_RE.exec(text);
  return m ? m[1] : null;
}

/** Returns { title, detail, code }. detail keeps the raw message for transparency. */
export function describeError(err) {
  const raw = err && (err.shortMessage || err.message) ? String(err.shortMessage || err.message) : String(err);
  if (err && (err.code === 4001 || err.code === "ACTION_REJECTED" || /user (rejected|denied)|rejected the request/i.test(raw))) {
    return { title: "You rejected the request in your wallet.", detail: raw, code: "wallet_rejected" };
  }
  const code = findContractCode(raw);
  if (code) return { title: CONTRACT_ERRORS[code], detail: raw, code };
  if (/chain|network/i.test(raw) && /expect|mismatch|wrong|switch/i.test(raw)) {
    return { title: "Your wallet is on a different network. Use \"Switch network\" and try again.", detail: raw, code: "wrong_chain" };
  }
  if (/failed to fetch|networkerror|network request failed|timeout|timed out|ECONN|ENOTFOUND/i.test(raw)) {
    return { title: "Could not reach the GenLayer RPC. Check your connection and the selected network.", detail: raw, code: "network" };
  }
  return { title: "The request failed.", detail: raw, code: "unknown" };
}
