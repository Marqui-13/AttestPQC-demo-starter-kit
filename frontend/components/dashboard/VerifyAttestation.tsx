'use client';

import { useState } from 'react';
import { useReadContract } from 'wagmi';
import { toast } from 'sonner';
import { Search } from 'lucide-react';
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

export function VerifyAttestation() {
  const [attestationId, setAttestationId] = useState('');
  const [lookupId, setLookupId] = useState<bigint | undefined>();

  const { data, isFetching, error, refetch } = useReadContract({
    address: PQC_ATTESTATION_REGISTRY_ADDRESS,
    abi: pqcAttestationRegistryAbi,
    functionName: 'getAttestation',
    args: lookupId !== undefined ? [lookupId] : undefined,
    query: { enabled: isRegistryConfigured && lookupId !== undefined },
  });

  const lookup = () => {
    if (!isRegistryConfigured) {
      toast.error('Set NEXT_PUBLIC_REGISTRY_ADDRESS in .env.local');
      return;
    }
    if (!attestationId) {
      toast.error('Enter an attestation ID');
      return;
    }
    setLookupId(BigInt(attestationId));
    void refetch();
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Search className="h-5 w-5 text-teal-700 dark:text-teal-400" />
          <CardTitle>Verify Attestation</CardTitle>
        </div>
        <CardDescription>
          Read on-chain attestation data directly from the registry contract.
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
          </div>
        )}
      </CardContent>
    </Card>
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