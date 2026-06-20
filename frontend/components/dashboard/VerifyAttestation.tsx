'use client';

import { useEffect, useRef, useState } from 'react';
import { useReadContract } from 'wagmi';
import { toast } from 'sonner';
import { CheckCircle2, Download, Search, ShieldCheck, Upload, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  isRegistryConfigured,
  PQC_ATTESTATION_REGISTRY_ADDRESS,
  pqcAttestationRegistryAbi,
} from '@/lib/wagmi-config';
import { truncateHex } from '@/lib/utils';
import {
  exportAttestationProof,
  importAttestationProofFromFile,
  loadAttestationProof,
  verifyAttestationOffChain,
  type AttestationProofRecord,
  type OffChainVerificationResult,
} from '@/lib/hybrid-pqc';
import {
  exportStarkProof,
  importStarkProofFromFile,
  loadStarkProof,
  starkCommitmentFromPublicInputs,
  verifyAttestationStarkProof,
  type StarkProofBundle,
} from '@/lib/stark-proof';
import type { Hex } from 'viem';

export function VerifyAttestation() {
  const [attestationId, setAttestationId] = useState('');
  const [lookupId, setLookupId] = useState<bigint | undefined>();
  const [proof, setProof] = useState<AttestationProofRecord | null>(null);
  const [verification, setVerification] = useState<OffChainVerificationResult | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [starkBundle, setStarkBundle] = useState<StarkProofBundle | null>(null);
  const [starkValid, setStarkValid] = useState<boolean | null>(null);
  const [starkVerifying, setStarkVerifying] = useState(false);
  const importInputRef = useRef<HTMLInputElement>(null);
  const starkImportRef = useRef<HTMLInputElement>(null);

  const { data, isFetching, error, refetch } = useReadContract({
    address: PQC_ATTESTATION_REGISTRY_ADDRESS,
    abi: pqcAttestationRegistryAbi,
    functionName: 'getAttestation',
    args: lookupId !== undefined ? [lookupId] : undefined,
    query: { enabled: isRegistryConfigured && lookupId !== undefined },
  });

  useEffect(() => {
    if (!data?.pqcSigHash) return;
    const local = loadAttestationProof(data.pqcSigHash as Hex);
    if (local) setProof(local);
  }, [data?.pqcSigHash]);

  useEffect(() => {
    if (!lookupId) return;
    const local = loadStarkProof(lookupId.toString());
    if (local) setStarkBundle(local);
  }, [lookupId]);

  const lookup = () => {
    if (!isRegistryConfigured) {
      toast.error('Set NEXT_PUBLIC_REGISTRY_ADDRESS in .env.local');
      return;
    }
    if (!attestationId) {
      toast.error('Enter an attestation ID');
      return;
    }
    setVerification(null);
    setStarkValid(null);
    setLookupId(BigInt(attestationId));
    void refetch();
  };

  const attachLocalProof = () => {
    if (!data?.pqcSigHash) return;
    const local = loadAttestationProof(data.pqcSigHash as Hex);
    if (local) {
      setProof(local);
      toast.message('Loaded proof from this browser');
    } else {
      toast.error('No local proof found — import a proof JSON file');
    }
  };

  const runStarkVerification = async () => {
    if (!data || !starkBundle) {
      toast.error('Load an attestation and attach a STARK proof first');
      return;
    }
    setStarkVerifying(true);
    try {
      const valid = await verifyAttestationStarkProof(starkBundle);
      const commitmentMatches =
        starkBundle.starkCommitment.toLowerCase() ===
        (data.starkCommitment as string).toLowerCase();
      setStarkValid(valid && commitmentMatches);
      if (valid && commitmentMatches) {
        toast.success('Winterfell STARK verification passed');
      } else if (valid) {
        toast.error('STARK proof valid but commitment mismatch', {
          description: 'On-chain commitment does not match proof public inputs',
        });
      } else {
        toast.error('STARK verification failed');
      }
    } catch (err) {
      setStarkValid(false);
      toast.error('STARK verification error', {
        description: err instanceof Error ? err.message : 'WASM error',
      });
    } finally {
      setStarkVerifying(false);
    }
  };

  const runVerification = async () => {
    if (!data || !proof) {
      toast.error('Load an attestation and attach a proof first');
      return;
    }
    setVerifying(true);
    try {
      const result = await verifyAttestationOffChain(
        {
          subject: data.subject as Hex,
          contentHash: data.contentHash as Hex,
          pqcPubKeyHash: data.pqcPubKeyHash as Hex,
          pqcSigHash: data.pqcSigHash as Hex,
        },
        proof,
      );
      setVerification(result);
      const allPass =
        result.signatureValid &&
        result.pubKeyHashMatches &&
        result.sigHashMatches &&
        result.messageMatches;
      if (allPass) {
        toast.success('Hybrid PQC verification passed');
      } else {
        toast.error('Verification failed', { description: 'See checklist below' });
      }
    } catch (err) {
      toast.error('Verification error', {
        description: err instanceof Error ? err.message : 'WASM error',
      });
    } finally {
      setVerifying(false);
    }
  };

  const handleImportProof = async (file: File) => {
    try {
      const imported = await importAttestationProofFromFile(file);
      setProof(imported);
      toast.success('Proof imported');
    } catch (err) {
      toast.error('Invalid proof file', {
        description: err instanceof Error ? err.message : 'Parse error',
      });
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Search className="h-5 w-5 text-teal-700 dark:text-teal-400" />
          <CardTitle>Verify Attestation</CardTitle>
        </div>
        <CardDescription>
          Look up on-chain data, verify hybrid PQC signatures off-chain, and optionally verify
          Winterfell STARK proofs bound to the anchored commitment.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-[12rem] flex-1">
            <Label htmlFor="verify-id">Attestation ID</Label>
            <Input
              id="verify-id"
              type="number"
              min="1"
              placeholder="1"
              value={attestationId}
              onChange={(e) => setAttestationId(e.target.value)}
            />
          </div>
          <Button onClick={lookup} disabled={isFetching}>
            {isFetching ? 'Loading…' : 'Lookup'}
          </Button>
        </div>

        {error && (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
            Could not load attestation. Check the ID and contract address.
          </p>
        )}

        {data && (
          <div className="space-y-3 rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-sm dark:border-zinc-800 dark:bg-zinc-900/50">
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium text-zinc-900 dark:text-zinc-100">
                Attestation #{lookupId?.toString()}
              </span>
              <Badge variant={data.revoked ? 'warning' : 'success'}>
                {data.revoked ? 'Revoked' : 'Active'}
              </Badge>
            </div>
            <Field label="Issuer" value={truncateHex(data.issuer, 8, 6)} />
            <Field label="Subject" value={truncateHex(data.subject)} />
            <Field label="Content hash" value={truncateHex(data.contentHash)} />
            <Field label="PQC pubkey hash" value={truncateHex(data.pqcPubKeyHash)} />
            <Field label="PQC sig hash" value={truncateHex(data.pqcSigHash)} />
            <Field
              label="STARK commitment"
              value={
                data.starkCommitment ===
                '0x0000000000000000000000000000000000000000000000000000000000000000'
                  ? 'Not anchored'
                  : truncateHex(data.starkCommitment)
              }
            />
            <Field label="Metadata" value={data.metadataURI || '—'} />
            <Field
              label="Timestamp"
              value={new Date(Number(data.timestamp) * 1000).toLocaleString()}
            />

            <div className="flex flex-wrap gap-2 border-t border-zinc-200 pt-3 dark:border-zinc-700">
              <Button size="sm" variant="outline" onClick={attachLocalProof}>
                Load local proof
              </Button>
              <Button size="sm" variant="outline" onClick={() => importInputRef.current?.click()}>
                <Upload className="mr-1 h-3 w-3" />
                Import proof
              </Button>
              {proof && (
                <Button size="sm" variant="outline" onClick={() => exportAttestationProof(proof)}>
                  <Download className="mr-1 h-3 w-3" />
                  Export proof
                </Button>
              )}
              <Button size="sm" onClick={runVerification} disabled={!proof || verifying}>
                <ShieldCheck className="mr-1 h-3 w-3" />
                {verifying ? 'Verifying…' : 'Verify PQC signature'}
              </Button>
              <input
                ref={importInputRef}
                type="file"
                accept="application/json,.json"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void handleImportProof(file);
                  e.target.value = '';
                }}
              />
            </div>

            {proof && (
              <p className="text-xs text-zinc-500">
                Proof loaded — sig {truncateHex(proof.pqcSigHash)} · issuer{' '}
                {truncateHex(proof.issuerAddress, 6, 4)}
              </p>
            )}

            <div className="flex flex-wrap gap-2 border-t border-zinc-200 pt-3 dark:border-zinc-700">
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  if (!lookupId) return;
                  const local = loadStarkProof(lookupId.toString());
                  if (local) {
                    setStarkBundle(local);
                    toast.message('Loaded STARK proof from this browser');
                  } else {
                    toast.error('No local STARK proof — import a STARK JSON file');
                  }
                }}
              >
                Load local STARK
              </Button>
              <Button size="sm" variant="outline" onClick={() => starkImportRef.current?.click()}>
                <Upload className="mr-1 h-3 w-3" />
                Import STARK
              </Button>
              {starkBundle && (
                <Button size="sm" variant="outline" onClick={() => exportStarkProof(starkBundle)}>
                  <Download className="mr-1 h-3 w-3" />
                  Export STARK
                </Button>
              )}
              <Button
                size="sm"
                onClick={runStarkVerification}
                disabled={!starkBundle || starkVerifying}
              >
                <ShieldCheck className="mr-1 h-3 w-3" />
                {starkVerifying ? 'Verifying…' : 'Verify STARK proof'}
              </Button>
              <input
                ref={starkImportRef}
                type="file"
                accept="application/json,.json"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    void importStarkProofFromFile(file)
                      .then((bundle) => {
                        setStarkBundle(bundle);
                        toast.success('STARK proof imported');
                      })
                      .catch((err: unknown) =>
                        toast.error('Invalid STARK file', {
                          description: err instanceof Error ? err.message : 'Parse error',
                        }),
                      );
                  }
                  e.target.value = '';
                }}
              />
            </div>

            {starkBundle && (
              <p className="text-xs text-zinc-500">
                STARK proof loaded — commitment {truncateHex(starkBundle.starkCommitment)} ·
                expected on-chain{' '}
                {truncateHex(
                  starkCommitmentFromPublicInputs(
                    starkBundle.publicInputs.subject,
                    starkBundle.publicInputs.content_hash,
                    starkBundle.publicInputs.attestation_id,
                    starkBundle.publicInputs.commitment,
                  ),
                )}
              </p>
            )}

            {verification && (
              <div className="space-y-2 rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-700 dark:bg-zinc-950">
                <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  PQC off-chain verification
                </p>
                <CheckItem ok={verification.messageMatches} label="Proof matches on-chain subject + content hashes" />
                <CheckItem ok={verification.pubKeyHashMatches} label="Public key hash matches registered issuer key" />
                <CheckItem ok={verification.sigHashMatches} label="Signature hash matches on-chain pqcSigHash" />
                <CheckItem
                  ok={verification.signatureValid}
                  label="Hybrid signature valid (ECDSA P-256 + ML-DSA-65)"
                />
              </div>
            )}

            {starkValid !== null && (
              <div className="space-y-2 rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-700 dark:bg-zinc-950">
                <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  STARK verification
                </p>
                <CheckItem
                  ok={starkValid}
                  label="Winterfell proof valid and commitment matches on-chain anchor"
                />
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function CheckItem({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className="flex items-start gap-2 text-sm">
      {ok ? (
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
      ) : (
        <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
      )}
      <span className={ok ? 'text-zinc-800 dark:text-zinc-200' : 'text-red-700 dark:text-red-300'}>
        {label}
      </span>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[9rem_1fr] gap-2">
      <span className="text-zinc-500 dark:text-zinc-400">{label}</span>
      <span className="break-all font-mono text-xs text-zinc-800 dark:text-zinc-200">{value}</span>
    </div>
  );
}