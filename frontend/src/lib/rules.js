// Mirrors constants of contracts/trustsentinel.py (RULES, CHAINS, COOLDOWN).
// If the deployed contract's rules change, update this file. The contract stays the authority.

export const CHAINS = ["ethereum", "bsc", "polygon", "arbitrum", "optimism", "base", "avalanche", "solana"];
export const COOLDOWN_SECONDS = 3600;

export const RULES = {
  ownership_renounced: { label: "Ownership renounced", factKey: "owner_is_zero_address", rule: "must be true" },
  mint_disabled: { label: "Minting disabled", factKey: "mint_authority_disabled", rule: "must be true" },
  liquidity_locked: { label: "Liquidity locked (30+ days)", factKey: "liquidity_lock_days_remaining", rule: "must be at least 30" },
  contract_verified: { label: "Source code verified", factKey: "source_code_verified", rule: "must be true" },
  audit_published: { label: "Audit published", factKey: "audit_report_found", rule: "must be true" },
  not_upgradeable: { label: "Not upgradeable", factKey: "is_upgradeable_proxy", rule: "must be false" },
  multisig_owner: { label: "Owner is a multisig", factKey: "owner_is_multisig", rule: "must be true" },
  sell_tax_max_10pct: { label: "Sell tax at most 10%", factKey: "sell_tax_bps", rule: "must be at most 1000 (basis points)" },
};

export const VERDICTS = {
  VERIFIED: { tone: "good", text: "Grounded evidence satisfies the rule for this claim type." },
  FLAGGED: { tone: "bad", text: "Grounded evidence contradicts the claim. This is not proof of fraud." },
  UNVERIFIED: { tone: "neutral", text: "No usable evidence yet (missing, unreachable, ungrounded or invalid). This is not a negative finding." },
  EXPIRED: { tone: "warn", text: "The last VERIFIED/FLAGGED result is older than the contract's TTL. Re-verify to refresh it." },
};

export const INDICATORS = {
  evidence_contradicts_claim: "The evidence states the opposite of the claim.",
  verdict_changed_since_previous: "The verdict changed compared with the previous check.",
  snippet_not_grounded: "The model's quote could not be found in the page, so it was discarded.",
  absolute_claim_language: "The claim text uses absolute wording (for example 100%, guaranteed, risk-free).",
  evidence_fact_missing: "The page does not clearly state the required fact.",
  evidence_fact_invalid: "The extracted value does not fit the rule (wrong type).",
  no_evidence_yet: "No evidence has been recorded for this claim yet.",
  evidence_stale: "The recorded evidence is older than the TTL.",
};

export const PROVENANCE = {
  none: "No evidence recorded",
  onchain_web: "Fetched and extracted by GenLayer validators from the allow-listed URL",
  attested: "Submitted by an authorised off-chain collector",
};

export const ACTIONS = {
  deployed: "Contract deployed",
  claim_submitted: "Claim submitted",
  evidence_recorded: "First evidence recorded",
  evidence_reconfirmed: "Evidence re-confirmed (unchanged)",
  evidence_changed: "Evidence or verdict changed",
  check_failed: "Check failed (verdict kept)",
  expired: "Marked expired",
};
