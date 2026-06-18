# AttestPQC — Foundry Test Strategy & Outline

## Recommended Testing Approach (Expert Level)

Use **Foundry** for comprehensive coverage:
- Unit tests for happy paths and reverts
- Fuzz testing on addresses, hashes, and IDs
- Invariant testing for critical properties
- Fork testing against Base Sepolia state (optional but powerful)

## Key Properties to Test / Invariants

1. Only addresses with a valid registered (and non-revoked) PQC key can issue attestations when they have the ISSUER_ROLE.
2. An attestation cannot be issued if the issuer's PQC key is revoked.
3. Revoking a PQC key prevents future issuances from that address (until re-registered).
4. Only the original issuer, admin, or auditor can revoke an attestation.
5. STARK proof anchoring can only be done by authorized parties for existing attestations.
6. Subject → latest attestation mapping always points to the most recent valid (non-revoked) attestation.
7. Total attestation count only increases on successful issuance.

## Example Test File Structure (`test/PQCAttestationRegistry.t.sol`)

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";
import {PQCAttestationRegistry} from "../src/PQCAttestationRegistry.sol";

contract PQCAttestationRegistryTest is Test {
    PQCAttestationRegistry public registry;
    address public admin = address(0x1);
    address public issuer = address(0x2);
    address public auditor = address(0x3);

    function setUp() public {
        vm.startPrank(admin);
        registry = new PQCAttestationRegistry();
        registry.initialize(admin);
        registry.grantRole(registry.ISSUER_ROLE(), issuer);
        registry.grantRole(registry.AUDITOR_ROLE(), auditor);
        vm.stopPrank();
    }

    function test_RegisterPQCKey() public {
        bytes32 pubKeyHash = keccak256("mock-pqc-pubkey");
        vm.prank(issuer);
        registry.registerPQCKey(pubKeyHash);
        assertTrue(registry.hasValidPQCKey(issuer));
    }

    function test_IssueAttestation() public {
        // Register key first
        bytes32 pubKeyHash = keccak256("mock-pqc-pubkey");
        vm.prank(issuer);
        registry.registerPQCKey(pubKeyHash);

        bytes32 subject = keccak256("subject-123");
        bytes32 contentHash = keccak256("document-content");
        bytes32 pqcSigHash = keccak256("pqc-signature");

        vm.prank(issuer);
        uint256 id = registry.issueAttestation(subject, contentHash, pqcSigHash, "ipfs://metadata");

        assertEq(id, 1);
        PQCAttestationRegistry.Attestation memory att = registry.getAttestation(id);
        assertEq(att.issuer, issuer);
        assertEq(att.pqcPubKeyHash, pubKeyHash);
    }

    function testFuzz_IssueWithDifferentSubjects(bytes32 subject) public {
        // Fuzz test: many different subjects should work
        vm.assume(subject != bytes32(0));
        // ... register key + issue logic
    }

    // Add more tests for revocation, STARK anchoring, unauthorized attempts, etc.
    // Use vm.expectRevert for error cases
}
```

## Running Tests

```bash
forge test -vvv                    # Verbose
forge test --gas-report
forge coverage
forge snapshot                     # Gas snapshots for CI
```

## Advanced Recommendations

- **Invariant Testing** (via `forge test --invariant` or custom invariants):
  - `attestationCount()` only increases or stays the same.
  - If a PQC key is revoked, `hasValidPQCKey(issuer)` returns false.
  - Revoked attestations stay revoked.

- **Fork Testing**:
  ```bash
  forge test --fork-url https://sepolia.base.org
  ```

- **CI Integration**: Add to GitHub Actions to run on every PR.

This level of testing demonstrates production-grade smart contract development and gives high confidence before testnet or mainnet deployment.
