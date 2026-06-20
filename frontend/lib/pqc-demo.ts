import { keccak256, toBytes, type Hex } from 'viem';

/** Demo helper until libcrux/oqs.js WASM is integrated. */
export function hashFromSeed(seed: string): Hex {
  return keccak256(toBytes(seed));
}

export function generateDemoPqcKeyMaterial(walletAddress: string) {
  const pubKeyHash = hashFromSeed(`pqc-pubkey:${walletAddress}:${Date.now()}`);
  const sigHash = hashFromSeed(`pqc-sig:${pubKeyHash}`);
  return { pubKeyHash, sigHash };
}

export function hashAttestationContent(content: string): Hex {
  return keccak256(toBytes(content));
}

export function hashSubject(identifier: string): Hex {
  return keccak256(toBytes(`subject:${identifier}`));
}

/** @deprecated Use Winterfell STARK via `@/lib/stark-proof`. */
export function generateDemoStarkCommitment(attestationId: string): Hex {
  return hashFromSeed(`stark-commitment:${attestationId}:${Date.now()}`);
}