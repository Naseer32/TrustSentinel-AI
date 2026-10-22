// Thin wrappers around the real TrustSentinel methods (see contracts/trustsentinel.py):
//   views : get_claim(claim_id, at_unix) get_history(claim_id, limit) find_claim(chain, subject, claim_type, evidence_url) get_nonce(who)
//   writes: submit_claim(chain, subject, claim_type, claim_text, evidence_url, nonce) verify_claim(claim_id) mark_expired(claim_id)
// Nothing here returns made-up data: every value comes from readContract/writeContract.
import { TransactionStatus, ExecutionResult } from "genlayer-js/types";
import { parseClaim, parseHistory, toInt, safeJson } from "./normalize.js";
import { normalizeText } from "./validate.js";

const READ_STATE = "accepted"; // fresher than "finalized"; shown to the user in the UI

function read(client, address, functionName, args) {
  return client.readContract({ address, functionName, args, stateStatus: READ_STATE });
}

export async function getClaim(client, address, id) {
  return parseClaim(await read(client, address, "get_claim", [Number(id), 0]));
}

export async function getHistory(client, address, id, limit = 20) {
  return parseHistory(await read(client, address, "get_history", [Number(id), limit]));
}

export async function findClaim(client, address, v) {
  const raw = await read(client, address, "find_claim", [v.chain, v.subject, v.claim_type, v.evidence_url]);
  return toInt(raw, "find_claim");
}

export async function getNonce(client, address, who) {
  return toInt(await read(client, address, "get_nonce", [who]), "get_nonce");
}

// Reachability probe: find_claim for a throw-away tuple is a real, side-effect-free view call.
export async function probeContract(client, address) {
  await findClaim(client, address, {
    chain: "ethereum", subject: "0x" + "0".repeat(40), claim_type: "ownership_renounced", evidence_url: "https://example.com/probe",
  });
}

export function claimArgs(v) {
  return [v.chain, v.subject, v.claim_type, normalizeText(v.claim_text), v.evidence_url, Number(v.nonce)];
}

function withTimeout(promise, ms, message) {
  let t;
  const timeout = new Promise((_, reject) => {
    t = setTimeout(() => reject(Object.assign(new Error(message), { timeout: true })), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(t));
}

const ACCEPT_TIMEOUT_MS = 10 * 60 * 1000;
const FINAL_TIMEOUT_MS = 20 * 60 * 1000;

/**
 * Sends one write and reports each lifecycle phase through onUpdate:
 *   signing -> pending (hash known) -> accepted | failed | unknown -> finalized (best effort, background)
 * `failed` means the receipt says execution finished with an error (state was not modified).
 */
export async function executeWrite({ writeClient, readClient, address, functionName, args }, onUpdate) {
  onUpdate({ phase: "signing", functionName, hash: null, finalized: false, error: null, receiptText: null });
  const hash = await writeClient.writeContract({ address, functionName, args, value: BigInt(0) });
  onUpdate({ phase: "pending", hash });

  let receipt;
  try {
    receipt = await withTimeout(
      readClient.waitForTransactionReceipt({ hash, status: TransactionStatus.ACCEPTED }),
      ACCEPT_TIMEOUT_MS,
      "The transaction was not accepted within 10 minutes. It may still be processing; check the hash in the explorer.",
    );
  } catch (error) {
    onUpdate({ phase: "stalled", error });
    return { hash, ok: false };
  }

  const receiptText = safeJson(receipt);
  const name = receipt?.txExecutionResultName;
  if (name === ExecutionResult.FINISHED_WITH_RETURN) {
    onUpdate({ phase: "accepted", receiptText });
  } else if (name === ExecutionResult.FINISHED_WITH_ERROR) {
    let trace = "";
    try {
      const t = await readClient.debugTraceTransaction({ hash });
      trace = safeJson({ result_code: t?.result_code, stderr: t?.stderr });
    } catch {
      /* trace is optional; not every network exposes it */
    }
    onUpdate({ phase: "failed", receiptText: trace ? receiptText + "\n\nTRACE:\n" + trace : receiptText });
    return { hash, ok: false };
  } else {
    onUpdate({ phase: "unknown", receiptText });
  }

  // Best-effort wait for FINALIZED; never blocks the UI.
  withTimeout(
    readClient.waitForTransactionReceipt({ hash, status: TransactionStatus.FINALIZED }),
    FINAL_TIMEOUT_MS,
    "finalization wait timed out",
  )
    .then(() => onUpdate({ finalized: true }))
    .catch(() => {});

  return { hash, ok: name === ExecutionResult.FINISHED_WITH_RETURN, unknown: name !== ExecutionResult.FINISHED_WITH_RETURN };
}
