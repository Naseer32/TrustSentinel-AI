# TrustSentinel AI (lean version)

A GenLayer Intelligent Contract that checks security claims made by Web3 projects
("ownership renounced", "liquidity locked 30+ days", ...) against evidence and records an
auditable verdict.

> **Status honesty box**
> * 78 unit tests pass, but only against a **mock** GenLayer SDK (`tests/mock_genlayer.py`).
> * Studio reported **"Could not load contract schema"** for the first (39 KB) version. The cause is
>   **not yet confirmed**. This lean version (about 25 KB) has not been loaded in Studio, the linter
>   or real GenVM. Not deployed. No live data fetched.

## If Studio says "Could not load contract schema"
1. Line 1 of the file is the `Depends` header. It must match what *your* Studio expects.
   Open a built-in example contract in Studio and copy **its** first line over ours.
   Common forms: `py-genlayer:test`, `py-genlayer:latest`, or a pinned `py-genlayer:<hash>`.
2. If it still fails, copy the exact error text (Studio logs / browser console) and report it.
Optional local check (needs internet): `pip install genvm-linter` then `genvm-lint check contracts/trustsentinel.py`.

## Rules the contract follows
1. The LLM never decides a verdict. It extracts one fact plus a verbatim quote from a page.
2. Code checks that the quote really appears in the page, then applies a fixed rule.
3. Missing, unreachable or ungrounded evidence = `UNVERIFIED`, never `FLAGGED`.
4. Every state change is appended to an audit trail.

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
* **`verify_claim(id)`**: validators fetch the allow-listed URL (`gl.nondet.web.get`), extract with the LLM,
  and each validator re-derives the result and checks the leader's quote exists in its own copy of the page.
* **`submit_attested_evidence(id, facts_json, source_url, observed_at)`**: an owner-approved collector submits
  structured facts it gathered off-chain (RPC, explorer API). Same rule engine, `provenance = "attested"`.
  Live collection code is not included.

Re-checks log `evidence_recorded`, `evidence_reconfirmed` or `evidence_changed`. Cooldown: 1 hour per claim.

## Security summary
* Evidence domains must be allow-listed by the owner (`set_domain`). Never allow-list user-generated-content
  hosts (gist, pastebin, github.io, medium) or a project's own site.
* URLs: https only, port 443, DNS names only (no IPs, localhost, punycode, userinfo), 512 chars max.
* Prompt injection: page is delimited and declared untrusted, claim text never enters the prompt,
  scripts/styles stripped, page truncated, strict JSON parsing, quote must literally occur in the page.
* Claim text rejects control/zero-width/bidi characters. Duplicates blocked by (chain, subject, type, URL).
* Replay: per-sender sequential nonce for `submit_claim`; attestations need strictly increasing `observed_at`
  within 7 days and no more than 5 minutes in the future.
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
```
78 tests: normal flows, adversarial input (URL/SSRF tricks, bidi characters, prompt injection, forged leaders),
boundaries (lengths, second-exact expiry, cooldown, clock skew, thresholds, caps), failures (404/5xx/network,
LLM crash, validator disagreement, state rollback). The mock cannot prove the contract loads on real GenVM.

## Unverified assumptions
1. The `Depends` header value for your Studio version (see top).
2. Raising `gl.UserError`; `datetime.now()` being pinned to transaction time.
3. `json` and `re` availability; attribute writes on dataclasses stored in `TreeMap` persist; `-> dict` / `-> list` return types accepted in the schema.
4. `gl.nondet.web.get(url)` gives `.status_code` and bytes `.body`; `exec_prompt` returns text.

## Limits
Only eight claim types; reads what allow-listed pages/collectors say, not chain state; redirects are not inspected;
history grows without bound; not audited. A VERIFIED result is not a safety guarantee.
