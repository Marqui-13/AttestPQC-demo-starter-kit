'use client';

import { DashboardHeader } from '@/components/dashboard/DashboardHeader';
import { RegistryStatus } from '@/components/dashboard/RegistryStatus';
import { RegisterPQCKey } from '@/components/dashboard/RegisterPQCKey';
import { IssueAttestation } from '@/components/dashboard/IssueAttestation';
import { AnchorSTARKProof } from '@/components/dashboard/AnchorSTARKProof';
import { VerifyAttestation } from '@/components/dashboard/VerifyAttestation';
import { isRegistryConfigured } from '@/lib/wagmi-config';
import { AlertTriangle } from 'lucide-react';

export function Dashboard() {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <DashboardHeader />
      <main className="mx-auto max-w-6xl space-y-8 px-4 py-8 sm:px-6">
        {!isRegistryConfigured && (
          <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <p>
              Contract address not configured. Set{' '}
              <code className="rounded bg-amber-100 px-1 py-0.5 font-mono text-xs dark:bg-amber-900/50">
                NEXT_PUBLIC_REGISTRY_ADDRESS
              </code>{' '}
              in <code className="font-mono text-xs">frontend/.env.local</code> after deploying to
              Base Sepolia. Demo hash buttons still work for UI testing.
            </p>
          </div>
        )}

        <section className="space-y-3">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
              Registry Dashboard
            </h2>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              Register PQC keys, issue attestations, anchor STARK proofs, and verify on-chain
              records.
            </p>
          </div>
          <RegistryStatus />
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <RegisterPQCKey />
          <IssueAttestation />
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <AnchorSTARKProof />
          <VerifyAttestation />
        </section>
      </main>
    </div>
  );
}