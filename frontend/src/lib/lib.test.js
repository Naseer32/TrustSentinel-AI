import test from "node:test";
import assert from "node:assert/strict";
import { plain, parseClaim, parseHistory, toInt } from "./normalize.js";
import { describeError, findContractCode } from "./errors.js";
import { validateClaimForm, validateUrl, validateSubject } from "./validate.js";
import { cooldownRemaining, fmtAgo, isHttps, short } from "./format.js";
import { RULES, CHAINS } from "./rules.js";

const ADDR = "0x" + "ab".repeat(20);
const claimMap = () =>
  new Map(Object.entries({
    claim_id: 1n, chain: "ethereum", subject: ADDR, claim_type: "ownership_renounced", claim_text: "x".repeat(10),
    evidence_url: "https://etherscan.io/a", submitter: ADDR, created_at: 10n, stored_verdict: "VERIFIED", status: "EXPIRED",
    verdict_at: 11n, expires_at: 12n, provenance: "onchain_web", evidence_key: "k", observed_at: 11n, source: "s",
    actor: ADDR, snippet: "q", indicators: ["evidence_stale"], risk_score: 10n, checks: 1n, last_check: 11n,
  }));

test("plain converts Map/bigint/Uint8Array recursively", () => {
  const out = plain(new Map([["a", 1n], ["b", [new Map([["c", 2n]])]], ["d", new Uint8Array([1, 255])]]));
  assert.deepEqual(out, { a: 1, b: [{ c: 2 }], d: "0x01ff" });
  assert.equal(plain(2n ** 80n), (2n ** 80n).toString());
});

test("parseClaim accepts a full claim and rejects missing fields", () => {
  const c = parseClaim(claimMap());
  assert.equal(c.status, "EXPIRED");
  assert.equal(c.risk_score, 10);
  const bad = claimMap();
  bad.delete("snippet");
  assert.throws(() => parseClaim(bad), /missing fields: snippet/);
  assert.throws(() => parseClaim("nope"), /not an object/);
});

test("parseHistory validates entries", () => {
  const h = parseHistory([new Map(Object.entries({ index: 3n, action: "claim_submitted", actor: ADDR, at: 5n, verdict: "UNVERIFIED", detail: "t" }))]);
  assert.equal(h[0].index, 3);
  assert.throws(() => parseHistory({}), /not a list/);
  assert.throws(() => parseHistory([new Map([["index", 1n]])]), /missing field/);
});

test("toInt", () => {
  assert.equal(toInt(5n), 5);
  assert.equal(toInt("7"), 7);
  assert.throws(() => toInt("x"), /Unexpected/);
});

test("contract error codes are found and described", () => {
  assert.equal(findContractCode("execution failed: bad_nonce: expected nonce 0"), "bad_nonce");
  assert.equal(findContractCode("the contract is paused"), null);
  assert.equal(describeError(new Error("boom cooldown: claim was checked too recently")).code, "cooldown");
  assert.equal(describeError({ code: 4001, message: "User rejected the request." }).code, "wallet_rejected");
  assert.equal(describeError(new Error("TypeError: Failed to fetch")).code, "network");
  assert.equal(describeError(new Error("The current chain of the wallet (id: 1) does not match the target chain, switch")).code, "wrong_chain");
  assert.equal(describeError(new Error("???")).code, "unknown");
});

test("URL validation mirrors the contract", () => {
  assert.equal(validateUrl("https://etherscan.io/address/" + ADDR), null);
  for (const u of ["http://etherscan.io/x", "https://etherscan.io@evil.com/x", "https://etherscan.io:8443/x", "https://127.0.0.1/x",
    "https://localhost/x", "https://xn--abc.io/x", "https://ether scan.io/x", "https://etherscan.io/" + "a".repeat(600), "", "https://x.io\\y"]) {
    assert.ok(validateUrl(u), u);
  }
  assert.equal(validateUrl("https://etherscan.io:443/x"), null);
});

test("subject validation", () => {
  assert.equal(validateSubject("ethereum", ADDR), null);
  assert.ok(validateSubject("ethereum", "0x123"));
  assert.equal(validateSubject("solana", "So11111111111111111111111111111111111111112"), null);
  assert.ok(validateSubject("solana", ADDR));
});

test("claim form validation and boundaries", () => {
  const ok = { chain: "ethereum", subject: ADDR, claim_type: "mint_disabled", claim_text: "x".repeat(8), evidence_url: "https://etherscan.io/x", nonce: "0" };
  assert.deepEqual(validateClaimForm(ok), {});
  assert.deepEqual(validateClaimForm({ ...ok, claim_text: "x".repeat(280) }), {});
  assert.ok(validateClaimForm({ ...ok, claim_text: "x".repeat(7) }).claim_text);
  assert.ok(validateClaimForm({ ...ok, claim_text: "x".repeat(281) }).claim_text);
  assert.ok(validateClaimForm({ ...ok, claim_text: "safe\u202etoken ok" }).claim_text);
  assert.ok(validateClaimForm({ ...ok, claim_type: "toString" }).claim_type);
  assert.ok(validateClaimForm({ ...ok, chain: "dogecoin" }).chain);
  assert.ok(validateClaimForm({ ...ok, nonce: "-1" }).nonce);
  assert.equal(Object.keys(RULES).length, 8);
  assert.equal(CHAINS.length, 8);
});

test("format helpers", () => {
  assert.equal(cooldownRemaining(1000, 3600, 1000 * 1000), 3600);
  assert.equal(cooldownRemaining(1000, 3600, (1000 + 3600) * 1000), 0);
  assert.equal(cooldownRemaining(0, 3600), 0);
  assert.equal(fmtAgo(1000, 1060 * 1000), "1 min ago");
  assert.equal(short("0x" + "a".repeat(40)), "0xaaaa...aaaa");
  assert.ok(isHttps("https://a.io") && !isHttps("javascript:alert(1)"));
});
