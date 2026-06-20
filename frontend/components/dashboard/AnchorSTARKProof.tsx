'use client';

import { useEffect, useState } from 'react';
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { toast } from 'sonner';
import { Cpu, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  isRegistryConfigured,
  PQC_ATTESTATION_REGISTRY_ADDRESS,
  pqcAttestationRegistryAbi,
} from '@/lib/wagmi-config';
import { loadAttestationProof } from '@/lib/hybrid-pqc';
import {
  deriveBlindingFromProof,
  generateAttestationStarkProof,
  loadStarkProof,
  type StarkProofBundle,
} from '@/lib/stark-proof';
import type { Hex } from 'viem';

export function AnchorSTARKProof() {
  const { address } = useAccount();
  const [attestationId, setAttestationId] = useState('');
  const [lookupId, setLookupId] = useState<bigint | undefined>();
  const [starkCommitment, setStarkCommitment] = useState('');
  const [generating, setGenerating] = useState(false);
  const [bundle, setBundle] = useState<StarkProofBundle | null>(null);

  const { data: attestation, isFetching } = useReadContract({
    address: PQC_ATTESTATION_REGISTRY_ADDRESS,
    abi: pqcAttestationRegistryAbi,
    functionName: 'getAttestation',
    args: lookupId !== undefined ? [lookupId] : undefined,
    query: { enabled: isRegistryConfigured && lookupId !== undefined },
  });

  const { writeContract, data: hash, isPending, reset } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  useEffect(() => {
    if (isSuccess && hash) {
      toast.success('STARK commitment anchored', {
        description: `Tx: ${hash.slice(0, 10)}…`,
      });
      reset();
    }
  }, [isSuccess, hash, reset]);

  const loadAttestation = () => {
    if (!attestationId) {
      toast.error('Enter an attestation ID first');
      return;
    }
    setLookupId(BigInt(attestationId));
    const saved = loadStarkProof(attestationId);
    if (saved) {
      setBundle(saved);
      setStarkCommitment(saved.starkCommitment);
    }
  };

  const generateProof = async () => {
    if (!attestationId) {
      toast.error('Enter an attestation ID first');
      return;
    }
    if (!lookupId || !attestation) {
      toast.error('Load the attestation from chain first');
      return;
    }

    setGenerating(true);
    try {
      const pqcProof = loadAttestationProof(attestation.pqcSigHash as Hex);
      const blinding = pqcProof ? deriveBlindingFromProof(pqcProof) : undefined;

      const result = await generateAttestationStarkProof({
        attestationId,
        subject: attestation.subject as Hex,
        contentHash: attestation.contentHash as Hex,
        blinding,
      });

      setBundle(result);
      setStarkCommitment(result.starkCommitment);
      toast.success('Winterfell STARK proof generated', {
        description: pqcProof
          ? 'Blinding derived from local attestation proof'
          : 'Random blinding — import attestation proof to make reproducible',
      });
    } catch (err) {
      toast.error('STARK proof failed', {
        description: err instanceof Error ? err.message : 'WASM error',
      });
    } finally {
      setGenerating(false);
    }
  };

  const anchor = () => {
    if (!isRegistryConfigured) {
      toast.error('Set NEXT_PUBLIC_REGISTRY_ADDRESS in .env.local');
      return;
    }
    if (!attestationId || !starkCommitment) {
      toast.error('Enter attestation ID and STARK commitment');
      return;
    }

    writeContract(
      {
        address: PQC_ATTESTATION_REGISTRY_ADDRESS,
        abi: pqcAttestationRegistryAbi,
        functionName: 'anchorSTARKProof',
        args: [BigInt(attestationId), starkCommitment as `0x${string}`],
      },
      {
        onError: (err) => toast.error('Anchor failed', { description: err.shortMessage }),
      },
    );
    toast.message('Confirm in your wallet');
  };

  const busy = isPending || isConfirming;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Cpu className="h-5 w-5 text-teal-700 dark:text-teal-400" />
          <CardTitle>3. Anchor zk-STARK Proof</CardTitle>
        </div>
        <CardDescription>
          Generate a Winterfell STARK proof binding the attestation subject and content hash to a
          private blinding factor, then anchor the resulting commitment on-chain.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="attestation-id">Attestation ID</Label>
            <Input
              id="attestation-id"
              type="number"
              min="1"
              placeholder="1"
              value={attestationId}
              onChange={(e) => setAttestationId(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="stark-commitment">STARK commitment (bytes32)</Label>
            <Input
              id="stark-commitment"
              placeholder="0x…"
              value={starkCommitment}
              onChange={(e) => setStarkCommitment(e.target.value)}
              className="font-mono text-xs"
            />
          </div>
        </div>

        {attestation && (
          <p className="text-xs text-zinc-500">
            Loaded attestation — subject {String(attestation.subject).slice(0, 12)}… · content{' '}
            {String(attestation.contentHash).slice(0, 12)}…
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          <Button onClick={loadAttestation} variant="outline" disabled={!address || isFetching}>
            {isFetching ? 'Loading…' : 'Load attestation'}
          </Button>
          <Button
            onClick={generateProof}
            variant="outline"
            disabled={!address || generating || !attestation}
          >
            <Sparkles className="mr-2 h-4 w-4" />
            {generating ? 'Proving…' : 'Generate STARK proof'}
          </Button>
          <Button onClick={anchor} disabled={busy || !address}>
            {busy ? 'Confirming…' : 'Anchor on-chain'}
          </Button>
        </div>

        {bundle && (
          <p className="text-xs text-zinc-500">
            Proof saved locally ({bundle.proofBytes.length.toLocaleString()} bytes) — verify in the
            lookup panel below.
          </p>
        )}
      </CardContent>
    </Card>
  );
}