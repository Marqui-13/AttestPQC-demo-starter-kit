'use client';

import { useEffect, useState } from 'react';
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
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
import { generateDemoStarkCommitment } from '@/lib/pqc-demo';

export function AnchorSTARKProof() {
  const { address } = useAccount();
  const [attestationId, setAttestationId] = useState('');
  const [starkCommitment, setStarkCommitment] = useState('');

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

  const generateDemo = () => {
    if (!attestationId) {
      toast.error('Enter an attestation ID first');
      return;
    }
    setStarkCommitment(generateDemoStarkCommitment(attestationId));
    toast.message('Demo STARK commitment generated', {
      description: 'Replace with Winterfell WASM output in production.',
    });
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
          Attach a STARK proof commitment to an existing attestation for privacy-preserving
          verification without revealing underlying data.
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
        <div className="flex flex-wrap gap-2">
          <Button onClick={generateDemo} variant="outline" disabled={!address}>
            <Sparkles className="mr-2 h-4 w-4" />
            Generate demo commitment
          </Button>
          <Button onClick={anchor} disabled={busy || !address}>
            {busy ? 'Confirming…' : 'Anchor on-chain'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}