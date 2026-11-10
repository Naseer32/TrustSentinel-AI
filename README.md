# TrustSentinel AI

A GenLayer Intelligent Contract that checks security claims made by Web3 projects
("ownership renounced", "audit published", ...) against evidence on an allow-listed web page and
records an auditable verdict. A React frontend reads and submits claims.

> **Status**
> * Deployed and tested on **GenLayer Studio Dev** (`studio-dev.genlayer.com`, GenVM `v0.3.0-rc7`).
>   Contract: `0x63Def4B2C76e5d14a1bE21d3b795608ab63b450b`.
> * Live checks done there: `set_domain`, `submit_claim`, `verify_claim`. A claim whose page does not
>   state the fact returned `UNVERIFIED`; an `audit_published` claim on the OpenZeppelin repo returned
>   `VERIFIED` with a quote copied from the page.
> * **Not yet tested live:** `submit_attested_evidence`, `mark_expired`, owner/collector/pause functions.
> * **Not deployed to Bradbury or any other testnet.**
> * The Python unit tests in `tests/` were written against a mock SDK **before** the contract was adapted
>   to the real SDK (see below). They have not been re-run since, and the mock may need updating.

## Frontend
`frontend/` (React + Vite) is live at https://trust-sentinel-ai.vercel.app and points at the contract above
through `frontend/.env` (`VITE_CONTRACT_ADDRESS`, `VITE_GENLAYER_NETWORK=studioDev`).
It needs `genlayer-js@2.0.0-rc.2`: version 1.1.8 could not read from the Studio Dev server.
Run locally: `cd frontend && npm install && npm run dev`.

## Contract header and SDK notes (real GenVM, Studio Dev)
* Line 1 must be `# { "Depends": "py-genlayer:test" }`. Pinned hashes copied from other places did not load.
* Storage decorator: `gl.storage.allow` (there is no `allow_storage`). `TreeMap` and `DynArray` come from `genlayer.storage`.
* Non-deterministic block: `gl.vm.run_nondet(leader_fn, validator_fn)` (not `run_nondet_unsafe`).
* Errors: `gl.vm.UserError`. Base class: `gl.contract.Contract`.
* Web fetch: `gl.nondet.web.get(url)`; the code accepts either `.status` or `.status_code`.
* Bradbury (Phase 2) may need a different header and SDK; see genlayerlabs/genlayer-cli issue 433.

## Rules the contract follows
1. The LLM never decides a verdict. It extracts one fact plus a verbatim quote from a page.
2. Code checks that the quote really appears in the page, then applies a fixed rule.
3. Missing, unreachable or ungrounded evidence = `UNVERIFIED`, never `FLAGGED`.
4. Every state change is appended to an audit trail.

The contract looks for the fact that belongs to the **claim type** (for example `audit_report_found`).
The free-text `claim_text` is stored but is not used to extract evidence.

| Verdict | Meaning |
|---|---|
| `VERIFIED` | Grounded evidence satisfies the rule. |
| `FLAGGED` | Grounded evidence contradicts the claim (not proof of fraud). |
| `UNVERIFIED` | No evidence yet, or evidence missing / unreachable / ungrounded / invalid. |
| `EXPIRED` | VERIFIED or FLAGGED older than 30 days (derived; `mark_expired` persists it). |

A failed fetch (404, 5xx, network) never overwrites an earlier verdict; it is logged as `check_failed`.

## Claim types
`ownership_renounced`, `mint_disabled`, `liquidity_locked` (>= 30 days), `contract_verified`,
`audit_published`, `not_upgradeable`, `multisig_owner`, `sell_tax_max_10pct` (<= 1000 bps).
Add a type by adding one line to `RULES`. Free-text claims outside these types are rejected.

## Evidence channels
* **`verify_claim(id)`**: validators fetch the allow-listed URL, extract with the LLM, and each validator
  re-derives the result and checks the leader's quote exists in its own copy of the page.
* **`submit_attested_evidence(id, facts_json, source_url, observed_at)`**: an owner-approved collector submits
  structured facts gathered off-chain. Same rule engine, `provenance = "attested"`. Live collection code is not included.

Re-checks log `evidence_recorded`, `evidence_reconfirmed` or `evidence_changed`. Cooldown: 1 hour per claim.

## Security summary
* Evidence domains must be allow-listed by the owner (`set_domain`). Never allow-list user-generated-content
  hosts (gist, pastebin, github.io, medium) or a project's own site.
* URLs: https only, port 443, DNS names only (no IPs, localhost, punycode, userinfo), 512 chars max.
* Prompt injection: page is delimited and declared untrusted, claim text never enters the prompt,
  scripts/styles stripped, page truncated, strict JSON parsing, quote must literally occur in the page.
* Claim text rejects control/zero-width/bidi characters. Duplicates blocked by (chain, subject, type, URL).
* Replay: per-sender sequential nonce for `submit_claim` (a rejected call does not use up the nonce);
  attestations need strictly increasing `observed_at` within 7 days and no more than 5 minutes in the future.
* Access: `owner` (two-step transfer), `collectors`, `paused`. Per-sender cap of 200 claims.
* `risk_score` (0-100) is a sum of indicator weights, not a probability of fraud.

## API
Writes: `submit_claim(chain, subject, claim_type, claim_text, evidence_url, nonce) -> id`, `verify_claim(id)`,
`submit_attested_evidence(...)`, `mark_expired(id)`; owner: `set_domain(domain, allow_subdomains, allowed)`,
`set_collector(addr, enabled)`, `set_paused(bool)`, `transfer_ownership(addr)` / `accept_ownership()`.
Views: `get_claim(id, at_unix)` (0 = now), `get_history(id, limit)`, `find_claim(chain, subject, type, url)`, `get_nonce(addr)`.
Chains: ethereum, bsc, polygon, arbitrum, optimism, base, avalanche (0x + 40 hex) and solana.

## Tests
```
python3 -m unittest discover -s tests -v     # Python 3.10+, no packages needed
cd frontend && node --test src/lib/lib.test.js   # frontend helpers: 9 tests pass
```
The Python tests use a mock SDK and cannot prove the contract loads on real GenVM. They predate the SDK
changes listed above and need to be re-run and, if needed, updated.

## Limits
Only eight claim types; reads what allow-listed pages/collectors say, not chain state; redirects are not inspected;
history grows without bound; not audited. A VERIFIED result is not a safety guarantee.
