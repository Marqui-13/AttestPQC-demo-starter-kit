import { createConfig, http } from 'wagmi';
import { defineChain } from 'viem';

export const baseSepolia = defineChain({
  id: 84532,
  name: 'Base Sepolia',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: {
    default: { http: [process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC ?? 'https://sepolia.base.org'] },
  },
});
import { injected } from 'wagmi/connectors';

export const config = createConfig({
  chains: [baseSepolia],
  connectors: [injected({ shimDisconnect: true })],
  transports: {
    [baseSepolia.id]: http(
      process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC ?? 'https://sepolia.base.org',
    ),
  },
  ssr: true,
});

// Update after deploying the contract to Base Sepolia
export const PQC_ATTESTATION_REGISTRY_ADDRESS =
  (process.env.NEXT_PUBLIC_REGISTRY_ADDRESS ??
    '0xYOUR_DEPLOYED_CONTRACT_ADDRESS_HERE') as `0x${string}`;

export const isRegistryConfigured =
  PQC_ATTESTATION_REGISTRY_ADDRESS !== '0xYOUR_DEPLOYED_CONTRACT_ADDRESS_HERE';

export const pqcAttestationRegistryAbi = [
  {
    type: 'function',
    name: 'registerPQCKey',
    inputs: [{ name: 'pubKeyHash', type: 'bytes32' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'revokePQCKey',
    inputs: [],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'issueAttestation',
    inputs: [
      { name: 'subject', type: 'bytes32' },
      { name: 'contentHash', type: 'bytes32' },
      { name: 'pqcSigHash', type: 'bytes32' },
      { name: 'metadataURI', type: 'string' },
    ],
    outputs: [{ name: 'attestationId', type: 'uint256' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'revokeAttestation',
    inputs: [{ name: 'attestationId', type: 'uint256' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'anchorSTARKProof',
    inputs: [
      { name: 'attestationId', type: 'uint256' },
      { name: 'starkCommitment', type: 'bytes32' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'getAttestation',
    inputs: [{ name: 'attestationId', type: 'uint256' }],
    outputs: [
      {
        name: '',
        type: 'tuple',
        components: [
          { name: 'subject', type: 'bytes32' },
          { name: 'issuer', type: 'address' },
          { name: 'pqcPubKeyHash', type: 'bytes32' },
          { name: 'contentHash', type: 'bytes32' },
          { name: 'pqcSigHash', type: 'bytes32' },
          { name: 'starkCommitment', type: 'bytes32' },
          { name: 'timestamp', type: 'uint64' },
          { name: 'revoked', type: 'bool' },
          { name: 'metadataURI', type: 'string' },
        ],
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getLatestAttestationForSubject',
    inputs: [{ name: 'subject', type: 'bytes32' }],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'hasValidPQCKey',
    inputs: [{ name: 'issuer', type: 'address' }],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'attestationCount',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'version',
    inputs: [],
    outputs: [{ name: '', type: 'string' }],
    stateMutability: 'pure',
  },
  {
    type: 'function',
    name: 'ISSUER_ROLE',
    inputs: [],
    outputs: [{ name: '', type: 'bytes32' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'AUDITOR_ROLE',
    inputs: [],
    outputs: [{ name: '', type: 'bytes32' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'hasRole',
    inputs: [
      { name: 'role', type: 'bytes32' },
      { name: 'account', type: 'address' },
    ],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'event',
    name: 'PQCKeyRegistered',
    inputs: [
      { name: 'issuer', type: 'address', indexed: true },
      { name: 'pubKeyHash', type: 'bytes32', indexed: true },
      { name: 'timestamp', type: 'uint64', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'AttestationIssued',
    inputs: [
      { name: 'attestationId', type: 'uint256', indexed: true },
      { name: 'subject', type: 'bytes32', indexed: true },
      { name: 'issuer', type: 'address', indexed: true },
      { name: 'pqcPubKeyHash', type: 'bytes32', indexed: false },
      { name: 'contentHash', type: 'bytes32', indexed: false },
      { name: 'pqcSigHash', type: 'bytes32', indexed: false },
      { name: 'timestamp', type: 'uint64', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'STARKProofAnchored',
    inputs: [
      { name: 'attestationId', type: 'uint256', indexed: true },
      { name: 'starkCommitment', type: 'bytes32', indexed: true },
      { name: 'anchorer', type: 'address', indexed: true },
      { name: 'timestamp', type: 'uint64', indexed: false },
    ],
  },
] as const;

/** keccak256("ISSUER_ROLE") — matches AccessControl role id */
export const ISSUER_ROLE_HASH =
  '0x114e74f6ea3bd819998f78687bfcb11b140da08e9b7d222fa9c1f1ba1f2aa122' as const;

export function grantIssuerRoleCastCommand(issuerAddress: string): string {
  const registry = PQC_ATTESTATION_REGISTRY_ADDRESS;
  return `cast send ${registry} "grantRole(bytes32,address)" ${ISSUER_ROLE_HASH} ${issuerAddress} --rpc-url $BASE_SEPOLIA_RPC --private-key $PRIVATE_KEY`;
}

export function wagmiErrorMessage(err: unknown): string {
  if (err && typeof err === 'object' && 'shortMessage' in err) {
    return String((err as { shortMessage: string }).shortMessage);
  }
  if (err instanceof Error) return err.message;
  return 'Transaction failed';
}