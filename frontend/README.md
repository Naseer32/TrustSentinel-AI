# TrustSentinel AI - Frontend (React + Vite)

Mobile-first web app for the deployed **TrustSentinel** GenLayer Intelligent Contract.
Every value shown comes from the contract (`readContract`) and every action is a real transaction
(`writeContract`). There are no mocked results anywhere in `src/` (the only fixtures are in the test files).

## Status (read first)
| Check | Result |
|---|---|
| Library unit tests (`npm test`, 9 tests, plain Node) | **Passed** in the build sandbox |
| Syntax check of every `.js`/`.jsx` file (TypeScript compiler) | **Passed** |
| Server-render smoke test of every component, with a stand-in for `genlayer-js` | **Passed** (also confirms claim text is HTML-escaped) |
| `npm install` and `npm run build` (Vite) | **NOT RUN**: the sandbox had no access to the npm registry |
| Running in a browser, connecting a wallet, sending a real transaction | **NOT RUN** |
| Talking to the deployed contract `0xBd0e...c85b` | **NOT RUN** |

So the app is untested against the real network. Run the steps below and report any error text.

## What the app does
* **Wallet**: connects a browser wallet (`window.ethereum`), shows the address, compares the wallet chain id with the
  selected network, and offers **Switch network** using `client.connect(<network>)` from `genlayer-js`.
  Reading claims works without a wallet.
* **Network selection**: studionet, localnet, testnetAsimov, testnetBradbury (the names `genlayer-js` documents).
  A read-only probe (`find_claim`) shows whether the contract answers on the selected network.
* **Check tab**: load a claim by id or find it by details, then see verdict, explanation, risk indicators,
  evidence (provenance, source, grounded quote, evidence key, who recorded it, timestamps) and audit history.
  Buttons: **Verify now** (`verify_claim`), **Mark as expired on-chain** (`mark_expired`, only when applicable).
* **Submit tab**: validates the form with the same rules as the contract, reads your nonce (`get_nonce`), warns about
  duplicates (`find_claim`), then sends `submit_claim`.
* **Transaction lifecycle**: confirm in wallet, submitted, accepted by consensus, finalized (in the background).
  Failed executions, wallet rejections, wrong network, timeouts and RPC failures each get a clear message plus technical details.
  If `verify_claim` ends with `check_failed` (page unreachable), the app says so and that the verdict was kept.

### Contract methods used (from `contracts/trustsentinel.py`)
| UI action | Contract call |
|---|---|
| Load claim | `get_claim(claim_id, 0)`, `get_history(claim_id, 20)` |
| Find by details / duplicate check / probe | `find_claim(chain, subject, claim_type, evidence_url)` |
| Nonce | `get_nonce(who)` |
| Submit | `submit_claim(chain, subject, claim_type, claim_text, evidence_url, nonce)` |
| Verify | `verify_claim(claim_id)` |
| Mark expired | `mark_expired(claim_id)` |

Intentionally **not** in the UI: owner/admin methods (`set_domain`, `set_collector`, `set_paused`, ownership transfer)
and `submit_attested_evidence` (collector-only). Use Studio for those.

## Setup (one step at a time)
1. Install Node.js 18 or newer (Termux: `pkg install nodejs`).
2. In this folder run: `npm install`
3. Run: `cp .env.example .env`
4. Open `.env` and confirm both values (see below).
5. Run the checks: `npm run check` (runs the unit tests and then `vite build`).
6. Start the app: `npm run dev` and open the printed URL.
7. Production build: `npm run build`, then `npm run preview`.

`.env` values:
* `VITE_CONTRACT_ADDRESS` : `0xBd0edA25839259009B61f7228c6f574190e1c85b` (the address you gave me).
* `VITE_GENLAYER_NETWORK` : `studionet` by default. **This is an assumption.** Change it if the contract is elsewhere.

## Details I could not confirm (please verify)
1. **Which network the contract is on.** You said you test in Studio, so `studionet` is assumed. If you use a local
   Studio, set `localnet`. The in-app probe tells you whether the contract answers on the selected network.
2. **That the deployed code is the current `trustsentinel.py`** (the 25 KB version). The UI relies on these exact
   view results: `get_claim` returns the fields listed in `src/lib/normalize.js`; `get_history` returns
   `index, action, actor, at, verdict, detail`. If the shape differs, the app shows which fields are missing instead of guessing.
3. **How `genlayer-js` decodes results.** Dicts may arrive as `Map`, integers as `bigint`; `src/lib/normalize.js` converts both.
   This was written from the SDK README, not observed live.
4. **Address arguments.** `get_nonce(who: Address)` is called with the wallet address string. If the SDK needs a different
   encoding the app shows "Could not read your nonce" and lets you type it manually (your number of submitted claims).
5. **Wallet on phones.** Normal mobile browsers have no `window.ethereum`. Open the app inside a wallet app's browser
   (for example MetaMask). Without a wallet you can still read claims.
6. **Rule and chain lists** in `src/lib/rules.js` (claim types, 1 hour cooldown) are copied from the contract source.
   If you redeploy a changed contract, update that file.
7. **`genlayer-js` version.** `package.json` uses `"latest"` because the registry was unreachable when this was written.
   After a successful `npm install`, pin the installed version in `package.json`.
8. Reads use the SDK option `stateStatus: "accepted"`, so they can be newer than finalized state.

## Troubleshooting
* *"Contract not reachable"*: wrong network selected, wrong address, or the RPC is down. The technical detail is shown.
* *"domain_not_allowed"* when submitting: the evidence URL's domain is not on the contract allow-list (owner action in Studio).
* *"cooldown"*: the claim was checked less than 1 hour ago.
* *Vite or esbuild fails on Termux*: share the exact error; native build tools sometimes need extra packages.
* Contract errors are recognised by their code (`bad_nonce`, `duplicate_claim`, ...) found in the receipt text. This is a
  text match, so unusual receipt formats show the raw receipt under "Technical details".

## Security notes
* No private keys are handled; signing happens in the wallet. Nothing sensitive is stored (only the chosen network name).
* All chain data is rendered as text (React escapes it). Links are only made for `https://` URLs and open with `noopener noreferrer`.
* Client-side validation only saves failed transactions; the contract remains the authority.
* A VERIFIED verdict is not a safety guarantee, and a risk score is not a probability of fraud.

## Layout
```
src/lib/contract.js   real contract calls + transaction lifecycle     src/lib/client.js    genlayer-js clients
src/lib/normalize.js  decodes SDK results, checks shapes              src/lib/errors.js    error mapping
src/lib/validate.js   form rules mirroring the contract               src/lib/rules.js     labels/texts from the contract
src/hooks/useWallet.js  wallet + network detection                    src/components/      UI
```
