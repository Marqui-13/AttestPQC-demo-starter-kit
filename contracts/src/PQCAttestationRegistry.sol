// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/**
 * @title AttestPQC — PQCAttestationRegistry
 * @author Marquivion Orr
 * @notice Production-grade upgradeable smart contract for post-quantum secure attestations and verifiable records.
 *         Core of the AttestPQC dApp: registers PQC public keys, issues attestations with PQC signature commitments,
 *         supports zk-STARK proof anchoring, and provides full auditability via events.
 *
 * @dev Expert patterns retained and enhanced from prior RecordRegistry:
 *      - UUPSUpgradeable + AccessControlDefaultAdminRules (secure delayed admin)
 *      - Custom errors, comprehensive indexed events
 *      - Pausable for emergencies, ReentrancyGuard
 *      - Crypto-agile design ready for native PQC verification and on-chain STARK verifiers in future upgrades
 *
 * PQC Integration:
 *      - Off-chain PQC key generation & signing (libcrux / oqs.js)
 *      - On-chain storage of PQC public key hash + signature hash (gas efficient)
 *      - Future: Add on-chain PQC signature verification when EVM precompiles or account abstraction mature
 *
 * zk-STARK Integration:
 *      - Anchor STARK proof commitments or public inputs on-chain
 *      - Enables verifiable claims (e.g. "attestation is valid + from registered PQC key + satisfies schema")
 *      - Proof generation happens client-side via Winterfell WASM
 */

import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {AccessControlDefaultAdminRulesUpgradeable} from "@openzeppelin/contracts-upgradeable/access/extensions/AccessControlDefaultAdminRulesUpgradeable.sol";
import {PausableUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import {ReentrancyGuardUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

contract PQCAttestationRegistry is 
    Initializable, 
    UUPSUpgradeable, 
    AccessControlDefaultAdminRulesUpgradeable,
    PausableUpgradeable, 
    ReentrancyGuardUpgradeable 
{
    // ============ ROLES ============
    bytes32 public constant ISSUER_ROLE = keccak256("ISSUER_ROLE");
    bytes32 public constant AUDITOR_ROLE = keccak256("AUDITOR_ROLE");

    // ============ STRUCTS ============
    struct PQCKey {
        bytes32 pubKeyHash;      // keccak256 of the PQC public key (ML-DSA etc.)
        uint64  registeredAt;
        bool    revoked;
    }

    struct Attestation {
        bytes32 subject;         // Usually the hash of the subject's identifier or DID
        address issuer;
        bytes32 pqcPubKeyHash;   // Links to registered PQC key
        bytes32 contentHash;     // Hash of the attested document/claim
        bytes32 pqcSigHash;      // Hash of the PQC signature over content
        bytes32 starkCommitment; // Optional zk-STARK proof commitment
        uint64  timestamp;
        bool    revoked;
        string  metadataURI;     // IPFS/Arweave pointer to full (encrypted) attestation data
    }

    // ============ STATE ============
    uint256 private _attestationCounter;

    mapping(address => PQCKey) public pqcKeys;                    // issuer => their PQC key
    mapping(uint256 => Attestation) public attestations;
    mapping(address => uint256[]) public issuerAttestations;      // issuer => list of attestation IDs they issued
    mapping(bytes32 => uint256) public subjectToLatestAttestation; // subject hash => latest attestation ID

    // ============ EVENTS ============
    event PQCKeyRegistered(
        address indexed issuer,
        bytes32 indexed pubKeyHash,
        uint64 timestamp
    );

    event PQCKeyRevoked(
        address indexed issuer,
        bytes32 indexed pubKeyHash,
        uint64 timestamp
    );

    event AttestationIssued(
        uint256 indexed attestationId,
        bytes32 indexed subject,
        address indexed issuer,
        bytes32 pqcPubKeyHash,
        bytes32 contentHash,
        bytes32 pqcSigHash,
        uint64 timestamp
    );

    event AttestationRevoked(
        uint256 indexed attestationId,
        address indexed revokedBy,
        uint64 timestamp
    );

    event STARKProofAnchored(
        uint256 indexed attestationId,
        bytes32 indexed starkCommitment,
        address indexed anchorer,
        uint64 timestamp
    );

    // ============ CUSTOM ERRORS ============
    error PQCKeyAlreadyRegistered(address issuer);
    error PQCKeyNotRegistered(address issuer);
    error PQCKeyIsRevoked(address issuer);
    error AttestationNotFound(uint256 id);
    error NotAuthorizedIssuer(address caller);
    error InvalidPQCKeyHash();
    error InvalidContentHash();
    error AlreadyRevoked(uint256 id);

    // ============ INITIALIZER ============
    function initialize(address initialAdmin) public initializer {
        require(initialAdmin != address(0), "Zero admin");

        __UUPSUpgradeable_init();
        __AccessControlDefaultAdminRules_init(1 days, initialAdmin);
        __Pausable_init();
        __ReentrancyGuard_init();
    }

    // ============ PQC KEY MANAGEMENT ============

    function registerPQCKey(bytes32 pubKeyHash) external whenNotPaused {
        if (pubKeyHash == bytes32(0)) revert InvalidPQCKeyHash();
        if (pqcKeys[msg.sender].pubKeyHash != bytes32(0)) revert PQCKeyAlreadyRegistered(msg.sender);

        pqcKeys[msg.sender] = PQCKey({
            pubKeyHash: pubKeyHash,
            registeredAt: uint64(block.timestamp),
            revoked: false
        });

        emit PQCKeyRegistered(msg.sender, pubKeyHash, uint64(block.timestamp));
    }

    function revokePQCKey() external whenNotPaused {
        PQCKey storage key = pqcKeys[msg.sender];
        if (key.pubKeyHash == bytes32(0)) revert PQCKeyNotRegistered(msg.sender);
        if (key.revoked) revert PQCKeyIsRevoked(msg.sender);

        key.revoked = true;
        emit PQCKeyRevoked(msg.sender, key.pubKeyHash, uint64(block.timestamp));
    }

    // ============ ATTESTATION MANAGEMENT ============

    function issueAttestation(
        bytes32 subject,
        bytes32 contentHash,
        bytes32 pqcSigHash,
        string calldata metadataURI
    ) 
        external 
        onlyRole(ISSUER_ROLE) 
        whenNotPaused 
        returns (uint256 attestationId) 
    {
        if (subject == bytes32(0)) revert InvalidContentHash(); // reuse error for simplicity
        if (contentHash == bytes32(0)) revert InvalidContentHash();

        PQCKey memory issuerKey = pqcKeys[msg.sender];
        if (issuerKey.pubKeyHash == bytes32(0) || issuerKey.revoked) {
            revert NotAuthorizedIssuer(msg.sender);
        }

        attestationId = ++_attestationCounter;

        attestations[attestationId] = Attestation({
            subject: subject,
            issuer: msg.sender,
            pqcPubKeyHash: issuerKey.pubKeyHash,
            contentHash: contentHash,
            pqcSigHash: pqcSigHash,
            starkCommitment: bytes32(0),
            timestamp: uint64(block.timestamp),
            revoked: false,
            metadataURI: metadataURI
        });

        issuerAttestations[msg.sender].push(attestationId);
        subjectToLatestAttestation[subject] = attestationId;

        emit AttestationIssued(
            attestationId,
            subject,
            msg.sender,
            issuerKey.pubKeyHash,
            contentHash,
            pqcSigHash,
            uint64(block.timestamp)
        );
    }

    function revokeAttestation(uint256 attestationId) external whenNotPaused {
        Attestation storage att = attestations[attestationId];
        if (att.issuer == address(0)) revert AttestationNotFound(attestationId);
        if (att.revoked) revert AlreadyRevoked(attestationId);

        // Only original issuer or admin/auditor can revoke
        if (msg.sender != att.issuer && 
            !hasRole(DEFAULT_ADMIN_ROLE, msg.sender) && 
            !hasRole(AUDITOR_ROLE, msg.sender)) {
            revert NotAuthorizedIssuer(msg.sender);
        }

        att.revoked = true;
        emit AttestationRevoked(attestationId, msg.sender, uint64(block.timestamp));
    }

    // ============ zk-STARK PROOF ANCHORING ============

    function anchorSTARKProof(uint256 attestationId, bytes32 starkCommitment) 
        external 
        whenNotPaused 
    {
        Attestation storage att = attestations[attestationId];
        if (att.issuer == address(0)) revert AttestationNotFound(attestationId);
        if (starkCommitment == bytes32(0)) revert InvalidContentHash();

        // Only issuer or authorized roles can anchor proofs for their attestations
        if (msg.sender != att.issuer && 
            !hasRole(ISSUER_ROLE, msg.sender) && 
            !hasRole(AUDITOR_ROLE, msg.sender)) {
            revert NotAuthorizedIssuer(msg.sender);
        }

        att.starkCommitment = starkCommitment;

        emit STARKProofAnchored(attestationId, starkCommitment, msg.sender, uint64(block.timestamp));
    }

    // ============ VIEW FUNCTIONS ============

    function getAttestation(uint256 attestationId) external view returns (Attestation memory) {
        Attestation memory att = attestations[attestationId];
        if (att.issuer == address(0)) revert AttestationNotFound(attestationId);
        return att;
    }

    function getLatestAttestationForSubject(bytes32 subject) external view returns (uint256) {
        return subjectToLatestAttestation[subject];
    }

    function hasValidPQCKey(address issuer) external view returns (bool) {
        PQCKey memory key = pqcKeys[issuer];
        return key.pubKeyHash != bytes32(0) && !key.revoked;
    }

    function attestationCount() external view returns (uint256) {
        return _attestationCounter;
    }

    // ============ ADMIN ============

    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }

    function _authorizeUpgrade(address newImplementation) 
        internal 
        override 
        onlyRole(DEFAULT_ADMIN_ROLE) 
    {}

    function version() external pure returns (string memory) {
        return "1.0.0-attestpqc-production";
    }
}
