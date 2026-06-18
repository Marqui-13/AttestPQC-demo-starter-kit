'use client';

import { useAccount, useConnect, useDisconnect, useSwitchChain } from 'wagmi';
import { Button } from '@/components/ui/button';
import { baseSepolia } from '@/lib/wagmi-config';
import { truncateHex } from '@/lib/utils';

export function ConnectWallet() {
  const { address, chain, isConnected } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain, isPending: isSwitching } = useSwitchChain();

  const onWrongChain = isConnected && chain?.id !== baseSepolia.id;

  if (!isConnected) {
    const connector = connectors[0];
    return (
      <Button
        onClick={() => connector && connect({ connector, chainId: baseSepolia.id })}
        disabled={!connector || isPending}
      >
        {isPending ? 'Connecting…' : 'Connect Wallet'}
      </Button>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {onWrongChain && (
        <Button
          size="sm"
          variant="outline"
          onClick={() => switchChain({ chainId: baseSepolia.id })}
          disabled={isSwitching}
        >
          Switch to Base Sepolia
        </Button>
      )}
      <span className="hidden rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 font-mono text-xs text-zinc-700 sm:inline dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
        {truncateHex(address ?? '', 6, 4)}
      </span>
      <Button size="sm" variant="ghost" onClick={() => disconnect()}>
        Disconnect
      </Button>
    </div>
  );
}