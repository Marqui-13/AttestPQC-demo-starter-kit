# AttestPQC Deployment Guide — Base Sepolia Testnet

## Prerequisites

- [Foundry](https://book.getfoundry.sh/getting-started/installation) (`forge`, `cast`)
- Wallet with Base Sepolia ETH (free via [Coinbase Developer Platform faucet](https://portal.cdp.coinbase.com))
- Node.js 20+ and Rust toolchain (for WASM rebuilds only)

## Step 1: Get Free Testnet ETH

1. Create a Coinbase account and open https://portal.cdp.coinbase.com
2. Under **Products → Onchain Tools**, open the **Faucet**
3. Enter your wallet address and request ETH (usually arrives in seconds)

## Step 2: Configure contracts

```bash
cd contracts
cp .env.example .env
# Edit .env — set PRIVATE_KEY (deployer wallet, never commit)
```

## Step 3: Test & deploy

```bash
cd contracts
forge test -vvv
forge script script/DeployPQCAttestationRegistry.s.sol \
  --rpc-url https://sepolia.base.org \
  --broadcast \
  -vvvv
```

Optional verification (requires `BASESCAN_API_KEY` in `.env`):

```bash
forge script script/DeployPQCAttestationRegistry.s.sol \
  --rpc-url https://sepolia.base.org \
  --broadcast \
  --verify
```

Copy the **proxy address** from the deploy output.

## Step 4: Grant issuer role (if needed)

The deploy script **grants `ISSUER_ROLE` to the deployer**. Skip this if you issue attestations from the same wallet that deployed.

If your MetaMask wallet differs from the deployer, grant the role from the **admin** key:

```bash
export REGISTRY_ADDRESS=0xYourProxyAddress
export BASE_SEPOLIA_RPC=https://sepolia.base.org

# Check role
cast call $REGISTRY_ADDRESS "hasRole(bytes32,address)(bool)" \
  $(cast keccak "ISSUER_ROLE") 0xYourWallet \
  --rpc-url $BASE_SEPOLIA_RPC

# Grant (admin PRIVATE_KEY only)
cast send $REGISTRY_ADDRESS \
  "grantRole(bytes32,address)" \
  $(cast keccak "ISSUER_ROLE") \
  0xYourIssuerAddress \
  --private-key $PRIVATE_KEY \
  --rpc-url $BASE_SEPOLIA_RPC
```

**Windows PowerShell:**

```powershell
cd contracts
$env:REGISTRY_ADDRESS = "0xYourProxyAddress"
.\scripts\grant-issuer.ps1 -IssuerAddress "0xYourMetaMaskAddress"
```

The dashboard **Issuer role** tile shows your status and a copy-paste `cast` command when the role is missing.

## Step 5: Frontend

```bash
cd frontend
cp .env.local.example .env.local
# Set NEXT_PUBLIC_REGISTRY_ADDRESS=0xYourProxyAddress
npm install
npm run dev
```

Pre-built WASM is included under `public/wasm/`. Rebuild only if you change the Rust crates:

```bash
npm run build:pqc-wasm   # libcrux hybrid PQC
npm run build:stark-wasm # Winterfell STARK (vendors winter-air on Windows)
```

Connect MetaMask on **Base Sepolia**, then:

1. Generate hybrid PQC keys → optional encrypted backup → register on-chain
2. Issue attestation (hybrid sign → on-chain)
3. Generate Winterfell STARK proof → anchor commitment
4. Verify PQC signature + STARK proof off-chain

See [HYBRID_PQC.md](./HYBRID_PQC.md) and [STARK_PROOF.md](./STARK_PROOF.md).

## Step 6: Verify on block explorer

Search your proxy address on [Base Sepolia Explorer](https://sepolia.basescan.org). Expect events: `PQCKeyRegistered`, `AttestationIssued`, `STARKProofAnchored`.

## Mainnet path (later)

- Deploy via the same script (higher gas; audit first)
- 2-of-3 multisig as `DEFAULT_ADMIN_ROLE`
- The Graph subgraph for indexing
- Monitoring (Tenderly alerts on `RoleGranted`, `Paused`, `Upgraded`)

## Common issues

| Issue | Fix |
|-------|-----|
| Insufficient funds | Request more ETH from the CDP faucet |
| Wrong network | Switch wallet to Base Sepolia (chain ID 84532) |
| `AccessControlUnauthorizedAccount` on grant | Use deployer/admin `PRIVATE_KEY`, not the issuer wallet |
| `PQCKeyAlreadyRegistered` after revoke | Contract blocks re-register; use a fresh wallet or upgrade |
| STARK WASM error | Run `npm run build:stark-wasm` |
| Issuer cannot issue | Grant `ISSUER_ROLE` and register PQC key hash first |