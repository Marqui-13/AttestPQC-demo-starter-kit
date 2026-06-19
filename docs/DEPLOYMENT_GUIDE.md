# AttestPQC Deployment Guide — Base Sepolia Testnet

## Prerequisites
- Foundry installed (`curl -L https://foundry.paradigm.xyz | bash && foundryup`)
- Wallet with Base Sepolia ETH (free from Alchemy faucet)
- `.env` file with:
  ```
  PRIVATE_KEY=0xyour_private_key_here
  BASE_SEPOLIA_RPC=https://sepolia.base.org
  ```

## Step 1: Get Free Testnet ETH
Create a Coinbase account to acces their developer platform.

Navigate to: https://portal.cdp.coinbase.com

On the left side menu under Products, select the Onchain Tools dropdown menu and access the Faucet. Enter your wallet address and request ETH. You should receive testnet funds within seconds.

## Step 2: Test & Deploy the Contract

```bash
cd contracts
forge test
forge script script/DeployPQCAttestationRegistry.s.sol --rpc-url https://sepolia.base.org --broadcast -vvvv
```

After deployment, copy the proxy address into `frontend/lib/wagmi-config.ts` and `frontend/.env.local.example`.

## Step 3: Grant Issuer Role

The deploy script **already grants `ISSUER_ROLE` to the deployer wallet**. You only need this step if your MetaMask wallet is **different** from the deployer.

Check the dashboard **Issuer role** tile after connecting — or use cast:

```bash
cd contracts
export REGISTRY_ADDRESS=0xYourProxyAddress
export BASE_SEPOLIA_RPC=https://sepolia.base.org

# Check role (replace $WALLET)
cast call $REGISTRY_ADDRESS "hasRole(bytes32,address)(bool)" \
  $(cast keccak "ISSUER_ROLE") $WALLET --rpc-url $BASE_SEPOLIA_RPC

# Grant to another wallet (admin PRIVATE_KEY only)
cast send $REGISTRY_ADDRESS \
  "grantRole(bytes32,address)" \
  $(cast keccak "ISSUER_ROLE") \
  $YOUR_ISSUER_ADDRESS \
  --private-key $PRIVATE_KEY \
  --rpc-url $BASE_SEPOLIA_RPC
```

Windows PowerShell helper:

```powershell
cd contracts
$env:REGISTRY_ADDRESS = "0xYourProxyAddress"
.\scripts\grant-issuer.ps1 -IssuerAddress "0xYourMetaMaskAddress"
```

## Step 4: Frontend

Update the contract address in `wagmi-config.ts`, then run:

```bash
cd frontend
npm run dev
```

Connect your wallet (switch to Base Sepolia), register a PQC key hash (generate one locally with a small script or oqs.js demo), and issue attestations.

## Step 5: Verify on Block Explorer

Go to Base Sepolia Explorer and search your contract address. You should see the `PQCKeyRegistered` and `AttestationIssued` events.

## Mainnet Path (Later)
- Deploy to mainnet via similar script (higher gas).
- Consider a 2-of-3 multisig as admin.
- Set up The Graph subgraph for production indexing.
- Add monitoring (Tenderly alerts on RoleGranted, Paused, Upgraded events).

## Common Issues
- "Insufficient funds" → Get more test ETH from the Alchemy faucet.
- Wrong network → Make sure MetaMask / wallet is on Base Sepolia Testnet.
- Contract not verified → Re-run with `--verify` flag (needs Etherscan API key for Base).

You're now running a live dApp on testnet with post-quantum ready attestations.
