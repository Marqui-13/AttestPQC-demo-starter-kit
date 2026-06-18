'use client';

import { useEffect, useState } from 'react';
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { toast } from 'sonner';
import { KeyRound, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  isRegistryConfigured,
  PQC_ATTESTATION_REGISTRY_ADDRESS,
  pqcAttestationRegistryAbi,
} from '@/lib/wagmi-config';
import { generateDemoPqcKeyMaterial } from '@/lib/pqc-demo';

export function RegisterPQCKey() {
  const { address } = useAccount();
  const [pubKeyHash, setPubKeyHash] = useState('');

  const { writeContract, data: hash, isPending, reset } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  useEffect(() => {
    if (isSuccess && hash) {
      toast.success('PQC key registered on-chain', {
        description: `Tx: ${hash.slice(0, 10)}…`,
      });
      reset();
    }
  }, [isSuccess, hash, reset]);

  const generateDemo = () => {
    if (!address) {
      toast.error('Connect your wallet first');
      return;
    }
    const { pubKeyHash: demoHash } = generateDemoPqcKeyMaterial(address);
    setPubKeyHash(demoHash);
    toast.message('Demo PQC key hash generated', {
      description: 'Replace with libcrux/oqs.js output in production.',
    });
  };

  const register = () => {
    if (!isRegistryConfigured) {
      toast.error('Set NEXT_PUBLIC_REGISTRY_ADDRESS in .env.local');
      return;
    }
    if (!pubKeyHash) {
      toast.error('Enter or generate a PQC public key hash');
      return;
    }

    writeContract(
      {
        address: PQC_ATTESTATION_REGISTRY_ADDRESS,
        abi: pqcAttestationRegistryAbi,
        functionName: 'registerPQCKey',
        args: [pubKeyHash as `0x${string}`],
      },
      {
        onError: (err) => toast.error('Registration failed', { description: err.shortMessage }),
      },
    );
    toast.message('Confirm in your wallet');
  };

  const busy = isPending || isConfirming;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <KeyRound className="h-5 w-5 text-teal-700 dark:text-teal-400" />
          <CardTitle>1. Register PQC Public Key</CardTitle>
        </div>
        <CardDescription>
          Generate a post-quantum keypair off-chain and register its hash on-chain to establish
          your quantum-resistant issuer identity.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label htmlFor="pqc-pubkey-hash">PQC Public Key Hash (bytes32)</Label>
          <Input
            id="pqc-pubkey-hash"
            placeholder="0x…"
            value={pubKeyHash}
            onChange={(e) => setPubKeyHash(e.target.value)}
            className="font-mono text-xs"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={generateDemo} variant="outline" disabled={!address}>
            <Sparkles className="mr-2 h-4 w-4" />
            Generate demo hash
          </Button>
          <Button onClick={register} disabled={busy || !address}>
            {busy ? 'Confirming…' : 'Register on-chain'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}