// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {PQCAttestationRegistry} from "../src/PQCAttestationRegistry.sol";

contract PQCAttestationRegistryTest is Test {
    PQCAttestationRegistry public registry;
    address public admin = makeAddr("admin");
    address public issuer = makeAddr("issuer");
    address public auditor = makeAddr("auditor");

    function setUp() public {
        PQCAttestationRegistry implementation = new PQCAttestationRegistry();
        bytes memory initData = abi.encodeCall(PQCAttestationRegistry.initialize, (admin));

        ERC1967Proxy proxy = new ERC1967Proxy(address(implementation), initData);
        registry = PQCAttestationRegistry(address(proxy));

        vm.startPrank(admin);
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

    function test_AnchorSTARKProof() public {
        bytes32 pubKeyHash = keccak256("mock-pqc-pubkey");
        vm.prank(issuer);
        registry.registerPQCKey(pubKeyHash);

        vm.prank(issuer);
        uint256 id = registry.issueAttestation(
            keccak256("subject"),
            keccak256("content"),
            keccak256("sig"),
            "ipfs://meta"
        );

        bytes32 commitment = keccak256("stark-proof");
        vm.prank(issuer);
        registry.anchorSTARKProof(id, commitment);

        PQCAttestationRegistry.Attestation memory att = registry.getAttestation(id);
        assertEq(att.starkCommitment, commitment);
    }
}