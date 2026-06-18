'use client';

import type { ReactNode } from 'react';
import { useAccount, useReadContract } from 'wagmi';
const BASE_SEPOLIA_CHAIN_ID = 84532;
import { AlertTriangle, CheckCircle2, KeyRound, FileCheck2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  isRegistryConfigured,
  PQC_ATTESTATION_REGISTRY_ADDRESS,
  pqcAttestationRegistryAbi,
} from '@/lib/wagmi-config';
import { truncateHex } from '@/lib/utils';

export function RegistryStatus() {
  const { address, chain } = useAccount();

  const { data: attestationCount } = useReadContract({
    address: PQC_ATTESTATION_REGISTRY_ADDRESS,
    abi: pqcAttestationRegistryAbi,
    functionName: 'attestationCount',
    query: { enabled: isRegistryConfigured },
  });

  const { data: hasValidKey } = useReadContract({
    address: PQC_ATTESTATION_REGISTRY_ADDRESS,
    abi: pqcAttestationRegistryAbi,
    functionName: 'hasValidPQCKey',
    args: address ? [address] : undefined,
    query: { enabled: isRegistryConfigured && !!address },
  });

  const onCorrectChain = chain?.id === BASE_SEPOLIA_CHAIN_ID;

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <StatusTile
        icon={<KeyRound className="h-4 w-4" />}
        label="Your PQC Key"
        value={
          !address
            ? 'Connect wallet'
            : hasValidKey
              ? 'Registered'
              : 'Not registered'
        }
        variant={hasValidKey ? 'success' : 'warning'}
      />
      <StatusTile
        icon={<FileCheck2 className="h-4 w-4" />}
        label="Attestations"
        value={
          isRegistryConfigured
            ? String(attestationCount ?? 0)
            : 'Contract not set'
        }
        variant={isRegistryConfigured ? 'default' : 'warning'}
      />
      <StatusTile
        icon={onCorrectChain ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
        label="Network"
        value={chain?.name ?? 'Not connected'}
        variant={onCorrectChain ? 'success' : 'warning'}
      />
      <StatusTile
        icon={<ShieldIcon />}
        label="Registry"
        value={
          isRegistryConfigured
            ? truncateHex(PQC_ATTESTATION_REGISTRY_ADDRESS)
            : 'Set NEXT_PUBLIC_REGISTRY_ADDRESS'
        }
        variant={isRegistryConfigured ? 'default' : 'warning'}
      />
    </div>
  );
}

function ShieldIcon() {
  return <CheckCircle2 className="h-4 w-4" />;
}

function StatusTile({
  icon,
  label,
  value,
  variant,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  variant: 'default' | 'success' | 'warning';
}) {
  return (
    <Card>
      <CardContent className="flex items-start gap-3 py-4">
        <div className="mt-0.5 text-teal-700 dark:text-teal-400">{icon}</div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            {label}
          </p>
          <p className="mt-1 truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            {value}
          </p>
          <Badge variant={variant} className="mt-2">
            {variant === 'success' ? 'Ready' : variant === 'warning' ? 'Action needed' : 'Live'}
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}