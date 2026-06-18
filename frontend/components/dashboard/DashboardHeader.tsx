'use client';

import { Shield } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { ConnectWallet } from '@/components/ConnectWallet';

export function DashboardHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-zinc-200/80 bg-white/90 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/90">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-700 text-white dark:bg-teal-600">
            <Shield className="h-5 w-5" aria-hidden />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
                AttestPQC
              </h1>
              <Badge variant="muted">Base Sepolia</Badge>
            </div>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Post-quantum attestations with zk-STARK anchoring
            </p>
          </div>
        </div>
        <ConnectWallet />
      </div>
    </header>
  );
}