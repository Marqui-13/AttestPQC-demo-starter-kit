# Hybrid PQC in AttestPQC

AttestPQC uses **libcrux** (Cryspen) for client-side hybrid post-quantum cryptography. The on-chain registry stores **hashes** of public keys and signatures for gas efficiency; full keys and signatures remain off-chain in browser storage.

## Algorithms

### Hybrid KEM keypair — `X25519MlKem768Draft00`

Implements the HPKE hybrid KEM from [draft-westerbaan-cfrg-hpke-xyber768d00](https://bwesterb.github.io/draft-westerbaan-cfrg-hpke-xyber768d00/draft-westerbaan-cfrg-hpke-xyber768d00.html) via `libcrux-kem`:

| Component | Size |
|-----------|------|
| ML-KEM-768 public key | 1184 B |
| X25519 public key | 32 B |
| **KEM public key total** | **1216 B** |
| ML-KEM-768 private key | 2400 B |
| X25519 private key | 32 B |
| **KEM private key total** | **2432 B** |

Encoding matches libcrux: `mlkem_pk || x25519_pk` (private: `mlkem_sk || x25519_sk`).

### Hybrid signature — P-256 ECDSA + ML-DSA-65

libcrux does not ship a combined hybrid signature, so AttestPQC composes:

| Layer | Algorithm | Details |
|-------|-----------|---------|
| Classical | P-256 ECDSA | SHA-256 over message (`libcrux-ecdsa`) |
| Post-quantum | ML-DSA-65 | FIPS 204, context `AttestPQC/v1` (`libcrux-ml-dsa`) |

**Signing public key** (concatenated):

- ECDSA P-256 uncompressed point: 64 B (`X || Y`)
- ML-DSA-65 verification key: 1952 B

**Hybrid signature** (concatenated):

- ECDSA `(r || s)`: 64 B
- ML-DSA-65 signature: 3309 B

Both schemes sign the **same canonical message**:

```
attestpqc/v1
subject:0x…
content:0x…
```

## On-chain commitments

| Field | Computation |
|-------|-------------|
| `pubKeyHash` | `keccak256(kem_public_key \|\| ecdsa_public_key \|\| mldsa_verification_key)` |
| `pqcSigHash` | `keccak256(ecdsa_sig \|\| mldsa_sig)` |

## WASM crate (`pqc-wasm/`)

Rust crate wrapping libcrux with `wasm-bindgen` exports:

- `generate_hybrid_identity_json()` — full hybrid key material
- `hybrid_public_key_json(identity)` — concatenated public key bytes
- `sign_hybrid_json(identity, message)` — hybrid signature bytes
- `verify_hybrid_json(identity, message, signature)` — local verification

### Build

```bash
cd pqc-wasm
cargo build --target wasm32-unknown-unknown --release
wasm-bindgen target/wasm32-unknown-unknown/release/pqc_wasm.wasm \
  --out-dir ../frontend/public/wasm/pqc --target web --out-name pqc_wasm
```

Or from `frontend/`:

```bash
npm run build:pqc-wasm
```

Output lands in `frontend/public/wasm/pqc/`.

## Browser storage & backup

| Key | Contents |
|-----|----------|
| `attestpqc:hybrid-identity:0x…` | Full hybrid identity (private keys) |
| `attestpqc:attestation-proof:0x…` | Off-chain proof bundle per `pqcSigHash` |
| `attestpqc:stark-proof:{id}` | Winterfell STARK proof bundle per attestation ID |

**Export / import:** Use **Export backup** on the Register step (AES-GCM + PBKDF2 passphrase). Attestation proofs and STARK proofs can be exported as JSON from Issue or Verify for third-party verification. See [STARK_PROOF.md](./STARK_PROOF.md).

## Off-chain verification

After looking up an attestation ID, attach a proof (local storage, or import JSON) and click **Verify PQC signature**. Checks:

1. Proof subject/content hashes match on-chain fields
2. `pubKeyHash` matches registered issuer key
3. `keccak256(signature bytes)` matches on-chain `pqcSigHash`
4. libcrux verifies ECDSA P-256 + ML-DSA-65 over the canonical message

This is appropriate for a testnet demo; production should use secure enclaves, hardware wallets, or encrypted vaults.

## References

- [libcrux KEM source](https://github.com/cryspen/libcrux/blob/main/libcrux-kem/src/kem.rs)
- [HPKE Xyber768d00 draft](https://bwesterb.github.io/draft-westerbaan-cfrg-hpke-xyber768d00/draft-westerbaan-cfrg-hpke-xyber768d00.html)
- [FIPS 204 ML-DSA](https://nvlpubs.nist.gov/nistpubs/FIPS/NIST.FIPS.204.pdf)