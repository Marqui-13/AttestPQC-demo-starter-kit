import type { Metadata } from 'next';
import { Toaster } from 'sonner';
import { Providers } from '@/components/providers';
import './globals.css';

export const metadata: Metadata = {
  title: 'AttestPQC — Post-Quantum Attestation Registry',
  description:
    'Decentralized, post-quantum secure attestations with zk-STARK proof anchoring on Base Sepolia.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full font-sans">
        <Providers>
          {children}
          <Toaster richColors position="bottom-right" closeButton />
        </Providers>
      </body>
    </html>
  );
}