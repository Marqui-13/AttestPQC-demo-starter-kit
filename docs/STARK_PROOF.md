# zk-STARK Proofs in AttestPQC

AttestPQC uses **Winterfell** (Rust STARK prover/verifier) compiled to WASM via `stark-wasm/`. Proofs are generated and verified **client-side**; the on-chain registry stores a `bytes32` **STARK commitment** for auditability (no on-chain verifier yet).

## Attestation-binding circuit

The demo circuit proves knowledge of a **private blinding factor** that binds on-chain attestation fields without revealing the witness:

| Column | Role |
|--------|------|
| `state` | Hash-chain state mixing subject, content hash, attestation ID, and blinding |
| `blinding` | Private witness (constant across trace) |

- **Trace length**: 64 steps (power of 2, browser-friendly)
- **Public inputs**: `subject`, `content_hash`, `attestation_id`, `commitment` (final field element)
- **Transition**: `next_state = state³ + blinding + content_hash + attestation_id`

The prover demonstrates the chain starts at the on-chain `subject` and ends at the public `commitment`, without exposing `blinding`.

See `stark-wasm/src/attestation_air.rs` for the AIR definition.

## On-chain commitment

The value stored in `Attestation.starkCommitment` is **not** the raw field element. It is:

```
keccak256(abi.encodePacked(
  "AttestPQC/stark/v1",
  subject,           // bytes32 from chain
  contentHash,       // bytes32 from chain
  attestationId,     // uint256
  commitment         // uint256 field element from proof
))
```

Computed in `frontend/lib/stark-proof.ts` via viem `encodePacked` + `keccak256`.

## Field mapping (bytes32 → STARK field)

Ethereum `bytes32` values map to Winterfell's f128 base field using the **low 16 bytes** (big-endian):

```
field = u128(bytes32[16..32])
```

Implemented in `stark-wasm` (`bytes32_to_field`) and `frontend/lib/stark-proof.ts` (`bytes32ToStarkFieldHex`).

## WASM crate (`stark-wasm/`)

| Export | Purpose |
|--------|---------|
| `prove_attestation_binding_json(request)` | Generate proof + public inputs |
| `verify_attestation_binding_json(request)` | Verify proof against public inputs |

### Build

From `frontend/`:

```bash
npm run build:stark-wasm
```

This runs `scripts/vendor-winter-air.py` first (required on **Windows** — Winterfell's `aux.rs` is a reserved path), then compiles and runs `wasm-bindgen`.

Output: `frontend/public/wasm/stark/` (`stark_wasm.js`, `stark_wasm_bg.wasm`).

On Linux/macOS the vendor step is harmless; the patched `vendor/winter-air-0.13.1/` is committed so all platforms share the same dependency.

## Browser storage

| Key | Contents |
|-----|----------|
| `attestpqc:stark-proof:{attestationId}` | Full STARK proof bundle (proof bytes + public inputs + on-chain commitment) |

Export/import JSON from the **Verify Attestation** panel (`type: attestpqc-stark`).

## Blinding reproducibility

If the issuer still has the local PQC attestation proof from step 2, blinding is derived deterministically:

```
keccak256("AttestPQC/blinding/v1" | subject | contentHash | subjectId | content)
```

Otherwise a random blinding factor is generated at prove time (proof still valid, but not reproducible).

## dApp flow

1. **Issue attestation** (step 2) — saves PQC proof locally
2. **Anchor STARK** (step 3):
   - Load attestation by ID
   - Generate STARK proof (Winterfell WASM; may take a few seconds)
   - Anchor `starkCommitment` on-chain
3. **Verify** — lookup ID → load/import STARK proof → **Verify STARK proof**

Checks: Winterfell verification passes **and** recomputed commitment matches on-chain `starkCommitment`.

## Security notes (testnet demo)

- Proof security target: ~80-bit conjectured (tuned for WASM prove time)
- No on-chain STARK verifier — trust is off-chain verify + commitment anchor
- Circuit is a **binding demo**, not attribute selective disclosure (extend with richer AIR for production)
- Formal verification of the circuit is a recommended next step

## References

- [Winterfell](https://github.com/novifinancial/winterfell)
- [AttestPQC hybrid PQC spec](./HYBRID_PQC.md)