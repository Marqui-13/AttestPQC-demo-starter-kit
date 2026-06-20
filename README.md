# AttestPQC — Post-Quantum + zk-STARK Verifiable Attestation dApp

**A production-grade decentralized application for registering post-quantum public keys, issuing tamper-proof attestations, and anchoring zk-STARK proofs on-chain.**

**GitHub-ready open source starter kit** demonstrating expert-level smart contract development, modern web3 frontend patterns, PQC integration, and zk-STARK capabilities.

---

## Layman's Explanation (Why This Matters)

Imagine a world where fake diplomas, forged medical records, counterfeit supply chain documents, and deepfake identities are everywhere. Today, when someone shows you a digital certificate or claim ("I have this license", "This product is ethically sourced", "I graduated from this university"), you usually have to trust the issuer completely or trust a central database that can be hacked or go offline.

**AttestPQC** changes that. It creates a **public, tamper-proof digital notary on the blockchain** that uses **future-proof quantum-resistant cryptography** (so it stays secure even when powerful quantum computers exist) and **zero-knowledge proofs** (so you can prove something is true without revealing the sensitive details behind it).

For everyday people and organizations:
- A university can issue a graduation attestation that anyone (employers, other schools) can instantly verify as authentic and unaltered — without the university having to maintain a fragile central database forever.
- A professional can prove "I hold a valid certification from Org X issued after 2025" using a privacy-preserving proof, without uploading their full certificate or personal details.
- Supply chain companies can anchor ethical sourcing claims on-chain so auditors and consumers can trust the data even years later.
- Individuals gain portable, self-sovereign digital credentials that survive company changes, data breaches, or even the shift to quantum computing.

In short: It makes digital trust **decentralized, private when needed, and secure for the long term** — protecting both individuals and organizations from fraud, forgery, and future technological threats.

---

## Concept & Branding

**Name**: **AttestPQC** (Attest + Post-Quantum Cryptography)

**Tagline**: Decentralized, post-quantum secure, and privacy-preserving attestations anchored on-chain with zk-STARK support.

**Specific Attestation Use Cases Highlighted**:
- Professional credentials & licenses (software engineering, medical, legal, trade certifications)
- Academic achievements & transcripts (portable, verifiable, privacy-preserving)
- Supply chain & provenance attestations (ethical sourcing, quality inspections, batch authenticity)
- Compliance & audit claims (regulatory attestations without exposing full audit data)
- Identity & KYC-lite claims with selective disclosure via zk-STARKs (prove attributes without revealing underlying documents)
- Personal verifiable claims (age, residency, qualifications) with strong privacy

The smart contract is the core trust layer. All critical actions (hybrid PQC key registration, attestation issuance, revocation, STARK proof anchoring) are on-chain transactions. The frontend provides a secure interface to interact with it.

**Testnet**: Base Sepolia (fast, cheap, excellent faucet via Coinbase Developer Platform)

---

## Tech Stack

**Smart Contracts**
- Solidity 0.8.26 + **Foundry** (forge, cast, anvil)
- OpenZeppelin v5 Upgradeable (UUPS + AccessControlDefaultAdminRules)
- Custom errors, comprehensive events, pausable, reentrancy guard
- Enhanced with hybrid PQC public key registration and attestation fields ready for PQC signatures + STARK commitments

**Frontend**
- Next.js 16 (App Router) + TypeScript + Tailwind CSS
- **wagmi v2 + viem** (injected wallet connector)
- **libcrux WASM** for hybrid PQC keygen and signing (`pqc-wasm/`)
- TanStack Query, sonner toasts

**PQC Library**
- **libcrux** (Cryspen) compiled to WASM via `pqc-wasm/`:
  - Hybrid KEM: `X25519MlKem768Draft00` ([Xyber768d00 draft](https://bwesterb.github.io/draft-westerbaan-cfrg-hpke-xyber768d00/draft-westerbaan-cfrg-hpke-xyber768d00.html))
  - Hybrid signatures: P-256 ECDSA + ML-DSA-65 (custom composition)
- See `docs/HYBRID_PQC.md` for byte layouts and on-chain hash commitments

**zk-STARK Library**
- **Winterfell** (pure Rust STARK prover/verifier) via `stark-wasm/`:
  - Attestation-binding AIR (private blinding → public commitment)
  - Client-side prove/verify in browser WASM
- See `docs/STARK_PROOF.md` for circuit, commitment formula, and build notes

**Indexing & Data**
- The Graph (subgraph for fast queries on attestations and events)
- Optional lightweight GraphQL backend for user preferences

**Blockchain**
- Base Sepolia (testnet) → Base mainnet or Ethereum L2s for production

---

## Project Structure

```
pqc-zk-registry-dapp/
├── README.md
├── docs/
│   ├── DEPLOYMENT_GUIDE.md            # Base Sepolia deploy + faucet + role grant
│   ├── HYBRID_PQC.md                  # libcrux hybrid KEM + signature spec
│   ├── STARK_PROOF.md                 # Winterfell circuit + commitment + WASM build
│   └── FOUNDRY_TESTS_OUTLINE.md       # Test strategy + example tests
├── scripts/
│   └── vendor-winter-air.py           # Patches winter-air for Windows builds
├── pqc-wasm/                          # Rust → WASM (libcrux hybrid PQC bindings)
├── stark-wasm/                        # Rust → WASM (Winterfell attestation-binding STARK)
├── vendor/winter-air-0.13.1/          # Vendored winter-air (aux.rs → auxiliary.rs patch)
├── contracts/
│   ├── foundry.toml
│   ├── .env.example                   # PRIVATE_KEY, RPC, Basescan API key
│   ├── scripts/
│   │   └── grant-issuer.ps1           # PowerShell helper for ISSUER_ROLE
│   ├── src/
│   │   └── PQCAttestationRegistry.sol # UUPS upgradeable registry (PQC + STARK fields)
│   ├── script/
│   │   └── DeployPQCAttestationRegistry.s.sol  # ERC1967 proxy deploy + ISSUER_ROLE grant
│   ├── test/
│   │   └── PQCAttestationRegistry.t.sol
│   └── lib/                           # Foundry deps (forge-std, OpenZeppelin v5)
└── frontend/
    ├── .env.local.example             # NEXT_PUBLIC_REGISTRY_ADDRESS, optional RPC
    ├── package.json
    ├── next.config.ts
    ├── app/
    │   ├── layout.tsx                 # Root layout + wagmi providers
    │   ├── page.tsx                   # Dashboard entry point
    │   └── globals.css
    ├── components/
    │   ├── ConnectWallet.tsx          # Injected wallet connect (MetaMask)
    │   ├── providers.tsx              # WagmiProvider + TanStack Query
    │   ├── dashboard/
    │   │   ├── Dashboard.tsx          # Main dashboard shell
    │   │   ├── DashboardHeader.tsx
    │   │   ├── RegistryStatus.tsx     # On-chain status tiles
    │   │   ├── RegisterPQCKey.tsx     # Step 1: register PQC key hash
    │   │   ├── IssueAttestation.tsx   # Step 2: issue attestation
    │   │   ├── AnchorSTARKProof.tsx   # Step 3: anchor STARK commitment
    │   │   └── VerifyAttestation.tsx  # Lookup + PQC/STARK off-chain verification
    │   └── ui/                        # Lightweight UI primitives (button, input, card, …)
    ├── public/wasm/pqc/               # Pre-built libcrux WASM (pqc_wasm.js + .wasm)
    ├── public/wasm/stark/             # Pre-built Winterfell WASM (stark_wasm.js + .wasm)
    └── lib/
        ├── wagmi-config.ts            # Chain config, contract ABI + address
        ├── hybrid-pqc.ts              # libcrux WASM loader, key storage, signing
        ├── pqc-demo.ts                # Hash helpers (subject/content hashing)
        ├── stark-proof.ts             # Winterfell STARK WASM loader + proof storage
        └── utils.ts
```

---

## Getting Started

### Smart Contracts (Foundry)

```bash
cd contracts
forge init . --force
forge install OpenZeppelin/openzeppelin-contracts-upgradeable
# Copy PQCAttestationRegistry.sol into src/
```

**Build, Test, Deploy to Base Sepolia**

```bash
forge build
forge test -vvv

# Deploy (you'll need a .env with PRIVATE_KEY and RPC)
forge script script/DeployPQCAttestationRegistry.s.sol --rpc-url https://sepolia.base.org --broadcast --verify
```

See [DEPLOYMENT_GUIDE.md](docs/DEPLOYMENT_GUIDE.md) for faucet links, role grants, and troubleshooting.

### Frontend

```bash
cd frontend
npm install
npm run build:pqc-wasm   # only needed if you change pqc-wasm/
npm run build:stark-wasm # only needed if you change stark-wasm/ (vendors winter-air on Windows)
npm run dev
```

Update `NEXT_PUBLIC_REGISTRY_ADDRESS` in `.env.local` after deployment.

**Key Flows in the dApp**:
1. Connect wallet (check **Issuer role** tile — grant via `cast` if not the deployer)
2. **Generate hybrid PQC keys** → export encrypted backup → **Register on-chain**
3. **Fill & hybrid-sign** → **Issue on-chain** (PQC proof auto-saved locally; export JSON to share)
4. **Anchor STARK** — load attestation → **Generate STARK proof** (Winterfell WASM) → **Anchor on-chain**
5. **Verify Attestation** — lookup ID → **Verify PQC signature** + **Verify STARK proof** (off-chain)
6. Anyone with exported proof JSON can verify without the issuer's private keys

## Security & Production Notes

- Contract follows established patterns (UUPS, delayed admin, custom errors, events, pausable).
- Hybrid PQC keypairs and signatures are generated client-side; on-chain we store commitments/hashes (gas efficient). Full on-chain hybrid PQC verification can be added in a future upgrade.
- STARK proofs are generated client-side; anchor commitments or public inputs on-chain for auditability.
- Full audit checklist, fuzz/invariant testing recommendations, and deployment hardening steps are in `docs/FOUNDRY_TESTS_OUTLINE.md`.
- `vendor/winter-air-0.13.1/` is committed intentionally — required for reproducible Winterfell builds on Windows.

---

## How to Contribute / Use This Kit

1. Clone or download this folder
2. Deploy the contract to Base Sepolia Testnet
3. Run the frontend locally and connect
4. Issue real attestations on testnet
5. Extend with your own PQC implementations, attestation schemas, custom STARK circuits, or frontend UI

This starter is designed to be **immediately usable for testnet demos** while providing a clear, production-ready path to mainnet.
