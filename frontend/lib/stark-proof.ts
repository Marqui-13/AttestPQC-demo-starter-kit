import { encodePacked, keccak256, toBytes, type Hex } from 'viem';
import type { AttestationProofRecord } from '@/lib/hybrid-pqc';

export interface StarkPublicInputs {
  subject: Hex;
  content_hash: Hex;
  attestation_id: string;
  commitment: string;
}

export interface StarkProofBundle {
  attestationId: string;
  proofBytes: number[];
  publicInputs: StarkPublicInputs;
  starkCommitment: Hex;
  createdAt: number;
}

type StarkWasmModule = {
  default: (input?: string | { module_or_path: string }) => Promise<unknown>;
  prove_attestation_binding_json: (requestJson: string) => string;
  verify_attestation_binding_json: (requestJson: string) => boolean;
};

const STORAGE_PREFIX = 'attestpqc:stark-proof:';
const WASM_JS_URL = '/wasm/stark/stark_wasm.js';
const WASM_BIN_URL = '/wasm/stark/stark_wasm_bg.wasm';

let wasmModulePromise: Promise<StarkWasmModule> | null = null;

async function loadWasmModule(): Promise<StarkWasmModule> {
  if (!wasmModulePromise) {
    wasmModulePromise = (async () => {
      const url = new URL(WASM_JS_URL, window.location.origin).href;
      const mod = (await import(/* webpackIgnore: true */ url)) as StarkWasmModule;
      await mod.default({ module_or_path: WASM_BIN_URL });
      return mod;
    })();
  }
  return wasmModulePromise;
}

function storageKey(attestationId: string): string {
  return `${STORAGE_PREFIX}${attestationId}`;
}

/** Map on-chain bytes32 into the STARK field (low 16 bytes, big-endian — matches stark-wasm). */
export function bytes32ToStarkFieldHex(value: Hex): Hex {
  const stripped = value.slice(2).padStart(64, '0');
  return `0x${'0'.repeat(32)}${stripped.slice(32)}`;
}

/** Deterministic blinding from off-chain attestation proof (issuer can reproduce). */
export function deriveBlindingFromProof(proof: AttestationProofRecord): Hex {
  const seed = [
    'AttestPQC/blinding/v1',
    proof.subject,
    proof.contentHash,
    proof.subjectId ?? '',
    proof.content ?? '',
  ].join('|');
  return keccak256(toBytes(seed));
}

/** Ethereum bytes32 commitment anchored on-chain from STARK public inputs. */
export function starkCommitmentFromPublicInputs(
  subject: Hex,
  contentHash: Hex,
  attestationId: string,
  commitment: string,
): Hex {
  const commitmentHex = commitment.startsWith('0x') ? commitment : `0x${commitment}`;
  return keccak256(
    encodePacked(
      ['string', 'bytes32', 'bytes32', 'uint256', 'uint256'],
      [
        'AttestPQC/stark/v1',
        subject,
        contentHash,
        BigInt(attestationId),
        BigInt(commitmentHex),
      ],
    ),
  );
}

export function saveStarkProof(bundle: StarkProofBundle): void {
  localStorage.setItem(storageKey(bundle.attestationId), JSON.stringify(bundle));
}

export function loadStarkProof(attestationId: string): StarkProofBundle | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem(storageKey(attestationId));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StarkProofBundle;
  } catch {
    return null;
  }
}

export interface GenerateStarkProofInput {
  attestationId: string;
  subject: Hex;
  contentHash: Hex;
  blinding?: Hex;
}

export async function generateAttestationStarkProof(
  input: GenerateStarkProofInput,
): Promise<StarkProofBundle> {
  const wasm = await loadWasmModule();
  const request = {
    subject: bytes32ToStarkFieldHex(input.subject),
    content_hash: bytes32ToStarkFieldHex(input.contentHash),
    attestation_id: input.attestationId,
    blinding: input.blinding ? bytes32ToStarkFieldHex(input.blinding) : undefined,
  };

  const responseJson = wasm.prove_attestation_binding_json(JSON.stringify(request));
  const response = JSON.parse(responseJson) as {
    proof_bytes: number[];
    public_inputs: StarkPublicInputs;
  };

  const publicInputs: StarkPublicInputs = {
    subject: input.subject,
    content_hash: input.contentHash,
    attestation_id: input.attestationId,
    commitment: response.public_inputs.commitment,
  };

  const bundle: StarkProofBundle = {
    attestationId: input.attestationId,
    proofBytes: response.proof_bytes,
    publicInputs,
    starkCommitment: starkCommitmentFromPublicInputs(
      input.subject,
      input.contentHash,
      input.attestationId,
      response.public_inputs.commitment,
    ),
    createdAt: Date.now(),
  };

  saveStarkProof(bundle);
  return bundle;
}

export async function verifyAttestationStarkProof(bundle: StarkProofBundle): Promise<boolean> {
  const wasm = await loadWasmModule();
  const request = {
    proof_bytes: bundle.proofBytes,
    public_inputs: {
      subject: bytes32ToStarkFieldHex(bundle.publicInputs.subject),
      content_hash: bytes32ToStarkFieldHex(bundle.publicInputs.content_hash),
      attestation_id: bundle.publicInputs.attestation_id,
      commitment: bundle.publicInputs.commitment,
    },
  };
  return wasm.verify_attestation_binding_json(JSON.stringify(request));
}

export function exportStarkProof(bundle: StarkProofBundle): void {
  const blob = new Blob([JSON.stringify({ type: 'attestpqc-stark', bundle }, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `attestpqc-stark-${bundle.attestationId}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function importStarkProofFromFile(file: File): Promise<StarkProofBundle> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result)) as {
          type?: string;
          bundle?: StarkProofBundle;
        };
        if (parsed.type === 'attestpqc-stark' && parsed.bundle?.proofBytes) {
          saveStarkProof(parsed.bundle);
          resolve(parsed.bundle);
          return;
        }
        if ('proofBytes' in (parsed as StarkProofBundle)) {
          const bundle = parsed as StarkProofBundle;
          saveStarkProof(bundle);
          resolve(bundle);
          return;
        }
        reject(new Error('Invalid STARK proof file'));
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}