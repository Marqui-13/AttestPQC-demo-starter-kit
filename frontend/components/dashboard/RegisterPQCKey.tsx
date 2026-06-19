'use client';

import { useEffect, useRef, useState } from 'react';
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { toast } from 'sonner';
import { Download, KeyRound, Sparkles, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  isRegistryConfigured,
  PQC_ATTESTATION_REGISTRY_ADDRESS,
  pqcAttestationRegistryAbi,
  wagmiErrorMessage,
} from '@/lib/wagmi-config';
import {
  exportEncryptedIdentity,
  getOrCreateHybridIdentity,
  importEncryptedIdentity,
  loadStoredIdentity,
} from '@/lib/hybrid-pqc';

export function RegisterPQCKey() {
  const { address } = useAccount();
  const [pubKeyHash, setPubKeyHash] = useState('');
  const [generating, setGenerating] = useState(false);
  const [passphrase, setPassphrase] = useState('');
  const importInputRef = useRef<HTMLInputElement>(null);

  const { writeContract, data: hash, isPending, reset } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  useEffect(() => {
    if (!address) {
      setPubKeyHash('');
      return;
    }
    const stored = loadStoredIdentity(address);
    if (stored) setPubKeyHash(stored.pubKeyHash);
  }, [address]);

  useEffect(() => {
    if (isSuccess && hash) {
      toast.success('PQC key registered on-chain', {
        description: `Tx: ${hash.slice(0, 10)}…`,
      });
      reset();
    }
  }, [isSuccess, hash, reset]);

  const generateHybridKeys = async () => {
    if (!address) {
      toast.error('Connect your wallet first');
      return;
    }
    setGenerating(true);
    try {
      const identity = await getOrCreateHybridIdentity(address);
      setPubKeyHash(identity.pubKeyHash);
      toast.success('Hybrid PQC identity generated', {
        description: 'X25519MlKem768Draft00 + P-256 ECDSA + ML-DSA-65',
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'WASM initialization failed';
      toast.error('Key generation failed', { description: message });
    } finally {
      setGenerating(false);
    }
  };

  const handleExport = async () => {
    if (!address) {
      toast.error('Connect your wallet first');
      return;
    }
    if (!passphrase || passphrase.length < 8) {
      toast.error('Enter an export passphrase (min 8 characters)');
      return;
    }
    try {
      await exportEncryptedIdentity(address, passphrase);
      toast.success('Identity exported', {
        description: 'Encrypted backup downloaded — store it safely offline.',
      });
    } catch (err) {
      toast.error('Export failed', {
        description: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  };

  const handleImport = async (file: File) => {
    if (!address) {
      toast.error('Connect your wallet first');
      return;
    }
    if (!passphrase) {
      toast.error('Enter the export passphrase');
      return;
    }
    try {
      const identity = await importEncryptedIdentity(file, passphrase, address);
      setPubKeyHash(identity.pubKeyHash);
      toast.success('Identity imported', { description: 'Hybrid keys restored to this browser.' });
    } catch (err) {
      toast.error('Import failed', {
        description: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  };

  const register = () => {
    if (!isRegistryConfigured) {
      toast.error('Set NEXT_PUBLIC_REGISTRY_ADDRESS in .env.local');
      return;
    }
    if (!pubKeyHash) {
      toast.error('Generate a hybrid PQC key first');
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
        onError: (err) => toast.error('Registration failed', { description: wagmiErrorMessage(err) }),
      },
    );
    toast.message('Confirm in your wallet');
  };

  const busy = isPending || isConfirming || generating;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <KeyRound className="h-5 w-5 text-teal-700 dark:text-teal-400" />
          <CardTitle>1. Register PQC Public Key</CardTitle>
        </div>
        <CardDescription>
          Generate a hybrid post-quantum identity off-chain (X25519+ML-KEM-768 KEM and P-256
          ECDSA+ML-DSA-65 signing) and register its keccak256 commitment on-chain.
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
        <div>
          <Label htmlFor="backup-passphrase">Backup passphrase (export / import)</Label>
          <Input
            id="backup-passphrase"
            type="password"
            placeholder="Min 8 characters"
            value={passphrase}
            onChange={(e) => setPassphrase(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={generateHybridKeys} variant="outline" disabled={!address || busy}>
            <Sparkles className="mr-2 h-4 w-4" />
            {generating ? 'Generating…' : 'Generate hybrid PQC keys'}
          </Button>
          <Button onClick={register} disabled={busy || !address}>
            {isPending || isConfirming ? 'Confirming…' : 'Register on-chain'}
          </Button>
          <Button onClick={handleExport} variant="outline" disabled={!address || !pubKeyHash}>
            <Download className="mr-2 h-4 w-4" />
            Export backup
          </Button>
          <Button
            variant="outline"
            disabled={!address}
            onClick={() => importInputRef.current?.click()}
          >
            <Upload className="mr-2 h-4 w-4" />
            Import backup
          </Button>
          <input
            ref={importInputRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleImport(file);
              e.target.value = '';
            }}
          />
        </div>
      </CardContent>
    </Card>
  );
}