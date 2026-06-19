import { keccak256, type Hex } from 'viem';
import { hashAttestationContent, hashSubject } from '@/lib/pqc-demo';

/** Raw key material returned by libcrux WASM (JSON-serialized). */
export interface HybridIdentityMaterial {
  kem_private_key: number[];
  kem_public_key: number[];
  ecdsa_private_key: number[];
  ecdsa_public_key: number[];
  mldsa_signing_key: number[];
  mldsa_verification_key: number[];
}

export interface StoredHybridIdentity {
  walletAddress: string;
  material: HybridIdentityMaterial;
  pubKeyHash: Hex;
  createdAt: number;
}

/** Public key bytes embedded in proofs so verifiers need not have issuer identity locally. */
export interface HybridPublicMaterial {
  kem_public_key: number[];
  ecdsa_public_key: number[];
  mldsa_verification_key: number[];
}

/** Off-chain proof bundle for hybrid signature verification. */
export interface AttestationProofRecord {
  pqcSigHash: Hex;
  subject: Hex;
  contentHash: Hex;
  signatureBytes: number[];
  pubKeyHash: Hex;
  publicMaterial?: HybridPublicMaterial;
  issuerAddress: string;
  subjectId?: string;
  content?: string;
  createdAt: number;
}

type PqcWasmModule = {
  default: (input?: string | { module_or_path: string }) => Promise<unknown>;
  generate_hybrid_identity_json: () => string;
  hybrid_public_key_json: (identityJson: string) => string;
  sign_hybrid_json: (identityJson: string, message: Uint8Array) => string;
  verify_hybrid_json: (
    identityJson: string,
    message: Uint8Array,
    signatureJson: string,
  ) => boolean;
};

const STORAGE_PREFIX = 'attestpqc:hybrid-identity:';
const PROOF_PREFIX = 'attestpqc:attestation-proof:';
const WASM_JS_URL = '/wasm/pqc/pqc_wasm.js';
const WASM_BIN_URL = '/wasm/pqc/pqc_wasm_bg.wasm';
const EXPORT_VERSION = 1;

let wasmModulePromise: Promise<PqcWasmModule> | null = null;

async function loadWasmModule(): Promise<PqcWasmModule> {
  if (!wasmModulePromise) {
    wasmModulePromise = (async () => {
      const url = new URL(WASM_JS_URL, window.location.origin).href;
      const mod = (await import(/* webpackIgnore: true */ url)) as PqcWasmModule;
      await mod.default({ module_or_path: WASM_BIN_URL });
      return mod;
    })();
  }
  return wasmModulePromise;
}

function storageKey(walletAddress: string): string {
  return `${STORAGE_PREFIX}${walletAddress.toLowerCase()}`;
}

function proofStorageKey(pqcSigHash: Hex): string {
  return `${PROOF_PREFIX}${pqcSigHash.toLowerCase()}`;
}

function toByteArray(bytes: number[]): Uint8Array {
  return Uint8Array.from(bytes);
}

function downloadJson(filename: string, data: unknown): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

function asBufferSource(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

async function deriveKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const base = await crypto.subtle.importKey('raw', enc.encode(passphrase), 'PBKDF2', false, [
    'deriveKey',
  ]);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: asBufferSource(salt), iterations: 310_000, hash: 'SHA-256' },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

function toBase64(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes));
}

function fromBase64(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function buildAttestationMessage(subjectHash: Hex, contentHash: Hex): Uint8Array {
  const payload = `attestpqc/v1\nsubject:${subjectHash}\ncontent:${contentHash}`;
  return new TextEncoder().encode(payload);
}

export function hashHybridPublicKey(publicKeyBytes: number[]): Hex {
  return keccak256(toByteArray(publicKeyBytes));
}

export function hashHybridSignature(signatureBytes: number[]): Hex {
  return keccak256(toByteArray(signatureBytes));
}

export function loadStoredIdentity(walletAddress: string): StoredHybridIdentity | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem(storageKey(walletAddress));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredHybridIdentity;
  } catch {
    return null;
  }
}

function saveStoredIdentity(record: StoredHybridIdentity): void {
  localStorage.setItem(storageKey(record.walletAddress), JSON.stringify(record));
}

export function saveAttestationProof(proof: AttestationProofRecord): void {
  localStorage.setItem(proofStorageKey(proof.pqcSigHash), JSON.stringify(proof));
}

export function loadAttestationProof(pqcSigHash: Hex): AttestationProofRecord | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem(proofStorageKey(pqcSigHash));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AttestationProofRecord;
  } catch {
    return null;
  }
}

export function publicMaterialFromIdentity(identity: StoredHybridIdentity): HybridPublicMaterial {
  return {
    kem_public_key: identity.material.kem_public_key,
    ecdsa_public_key: identity.material.ecdsa_public_key,
    mldsa_verification_key: identity.material.mldsa_verification_key,
  };
}

function materialForVerify(publicMaterial: HybridPublicMaterial): HybridIdentityMaterial {
  return {
    kem_private_key: [],
    kem_public_key: publicMaterial.kem_public_key,
    ecdsa_private_key: [],
    ecdsa_public_key: publicMaterial.ecdsa_public_key,
    mldsa_signing_key: [],
    mldsa_verification_key: publicMaterial.mldsa_verification_key,
  };
}

/** Generate or load hybrid identity (X25519MlKem768Draft00 + P-256 ECDSA + ML-DSA-65). */
export async function getOrCreateHybridIdentity(
  walletAddress: string,
): Promise<StoredHybridIdentity> {
  const existing = loadStoredIdentity(walletAddress);
  if (existing) return existing;

  const wasm = await loadWasmModule();
  const materialJson = wasm.generate_hybrid_identity_json();
  const material = JSON.parse(materialJson) as HybridIdentityMaterial;
  const pubKeyBytes = JSON.parse(wasm.hybrid_public_key_json(materialJson)) as number[];

  const record: StoredHybridIdentity = {
    walletAddress: walletAddress.toLowerCase(),
    material,
    pubKeyHash: hashHybridPublicKey(pubKeyBytes),
    createdAt: Date.now(),
  };
  saveStoredIdentity(record);
  return record;
}

export interface HybridSignResult {
  pqcSigHash: Hex;
  signatureBytes: number[];
  pubKeyHash: Hex;
  verified: boolean;
}

/** Sign attestation payload; returns signature bytes and keccak256 commitment. */
export async function signAttestationHybrid(
  walletAddress: string,
  subjectHash: Hex,
  contentHash: Hex,
  extras?: { subjectId?: string; content?: string },
): Promise<HybridSignResult> {
  const identity = await getOrCreateHybridIdentity(walletAddress);
  const wasm = await loadWasmModule();
  const materialJson = JSON.stringify(identity.material);
  const message = buildAttestationMessage(subjectHash, contentHash);
  const signatureBytes = JSON.parse(
    wasm.sign_hybrid_json(materialJson, message),
  ) as number[];
  const verified = wasm.verify_hybrid_json(
    materialJson,
    message,
    JSON.stringify(signatureBytes),
  );
  const pqcSigHash = hashHybridSignature(signatureBytes);

  const proof: AttestationProofRecord = {
    pqcSigHash,
    subject: subjectHash,
    contentHash,
    signatureBytes,
    pubKeyHash: identity.pubKeyHash,
    publicMaterial: publicMaterialFromIdentity(identity),
    issuerAddress: walletAddress.toLowerCase(),
    subjectId: extras?.subjectId,
    content: extras?.content,
    createdAt: Date.now(),
  };
  saveAttestationProof(proof);

  return {
    pqcSigHash,
    signatureBytes,
    pubKeyHash: identity.pubKeyHash,
    verified,
  };
}

export interface OffChainVerificationResult {
  signatureValid: boolean;
  pubKeyHashMatches: boolean;
  sigHashMatches: boolean;
  messageMatches: boolean;
}

/** Verify hybrid signature against on-chain fields (public keys from proof or identity). */
function resolvePublicMaterial(proof: AttestationProofRecord): HybridPublicMaterial {
  if (proof.publicMaterial?.ecdsa_public_key?.length) {
    return proof.publicMaterial;
  }
  const issuerIdentity = loadStoredIdentity(proof.issuerAddress);
  if (issuerIdentity) return publicMaterialFromIdentity(issuerIdentity);
  throw new Error('Proof is missing public keys — import issuer identity or a newer proof export');
}

export async function verifyAttestationOffChain(
  onChain: {
    subject: Hex;
    contentHash: Hex;
    pqcPubKeyHash: Hex;
    pqcSigHash: Hex;
  },
  proof: AttestationProofRecord,
): Promise<OffChainVerificationResult> {
  const wasm = await loadWasmModule();
  const publicMaterial = resolvePublicMaterial(proof);
  const message = buildAttestationMessage(onChain.subject, onChain.contentHash);
  const messageMatches =
    proof.subject.toLowerCase() === onChain.subject.toLowerCase() &&
    proof.contentHash.toLowerCase() === onChain.contentHash.toLowerCase();

  const signatureValid = wasm.verify_hybrid_json(
    JSON.stringify(materialForVerify(publicMaterial)),
    message,
    JSON.stringify(proof.signatureBytes),
  );

  const pubKeyHashMatches =
    proof.pubKeyHash.toLowerCase() === onChain.pqcPubKeyHash.toLowerCase();
  const sigHashMatches = hashHybridSignature(proof.signatureBytes).toLowerCase() === onChain.pqcSigHash.toLowerCase();

  return {
    signatureValid,
    pubKeyHashMatches,
    sigHashMatches,
    messageMatches,
  };
}

export async function encryptForExport(
  payload: unknown,
  passphrase: string,
): Promise<{ v: number; salt: string; iv: string; ciphertext: string }> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(passphrase, salt);
  const plaintext = new TextEncoder().encode(JSON.stringify(payload));
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: asBufferSource(iv) },
    key,
    plaintext,
  );
  return {
    v: EXPORT_VERSION,
    salt: toBase64(salt),
    iv: toBase64(iv),
    ciphertext: toBase64(new Uint8Array(ciphertext)),
  };
}

export async function decryptFromExport<T>(
  envelope: { v: number; salt: string; iv: string; ciphertext: string },
  passphrase: string,
): Promise<T> {
  if (envelope.v !== EXPORT_VERSION) {
    throw new Error('Unsupported export version');
  }
  const key = await deriveKey(passphrase, fromBase64(envelope.salt));
  const iv = fromBase64(envelope.iv);
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: asBufferSource(iv) },
    key,
    asBufferSource(fromBase64(envelope.ciphertext)),
  );
  return JSON.parse(new TextDecoder().decode(plaintext)) as T;
}

export async function exportEncryptedIdentity(
  walletAddress: string,
  passphrase: string,
): Promise<void> {
  const identity = loadStoredIdentity(walletAddress);
  if (!identity) throw new Error('No hybrid identity in this browser for the connected wallet');
  const envelope = await encryptForExport(
    { type: 'attestpqc-identity', identity },
    passphrase,
  );
  downloadJson(
    `attestpqc-identity-${walletAddress.slice(2, 10)}.json`,
    envelope,
  );
}

export async function importEncryptedIdentity(
  file: File,
  passphrase: string,
  expectedWallet?: string,
): Promise<StoredHybridIdentity> {
  const raw = await readFileAsText(file);
  const envelope = JSON.parse(raw) as { v: number; salt: string; iv: string; ciphertext: string };
  const decoded = await decryptFromExport<{ type: string; identity: StoredHybridIdentity }>(
    envelope,
    passphrase,
  );
  if (decoded.type !== 'attestpqc-identity' || !decoded.identity?.material) {
    throw new Error('Invalid identity export file');
  }
  if (
    expectedWallet &&
    decoded.identity.walletAddress.toLowerCase() !== expectedWallet.toLowerCase()
  ) {
    throw new Error('Identity wallet address does not match connected wallet');
  }
  saveStoredIdentity(decoded.identity);
  return decoded.identity;
}

export function exportAttestationProof(proof: AttestationProofRecord): void {
  downloadJson(`attestpqc-proof-${proof.pqcSigHash.slice(2, 10)}.json`, {
    type: 'attestpqc-proof',
    proof,
  });
}

export function importAttestationProofFromFile(file: File): Promise<AttestationProofRecord> {
  return readFileAsText(file).then((raw) => {
    const parsed = JSON.parse(raw) as { type?: string; proof?: AttestationProofRecord };
    if (parsed.type === 'attestpqc-proof' && parsed.proof?.signatureBytes) {
      saveAttestationProof(parsed.proof);
      return parsed.proof;
    }
    if ('signatureBytes' in (parsed as AttestationProofRecord)) {
      const proof = parsed as AttestationProofRecord;
      saveAttestationProof(proof);
      return proof;
    }
    throw new Error('Invalid attestation proof file');
  });
}

export { hashAttestationContent, hashSubject };