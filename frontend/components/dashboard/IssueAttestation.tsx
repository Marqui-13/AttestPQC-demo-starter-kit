'use client';

import { useEffect, useState } from 'react';
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { toast } from 'sonner';
import { FileBadge2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  isRegistryConfigured,
  PQC_ATTESTATION_REGISTRY_ADDRESS,
  pqcAttestationRegistryAbi,
} from '@/lib/wagmi-config';
import {
  generateDemoPqcKeyMaterial,
  hashAttestationContent,
  hashSubject,
} from '@/lib/pqc-demo';

export function IssueAttestation() {
  const { address } = useAccount();
  const [subjectId, setSubjectId] = useState('');
  const [content, setContent] = useState('');
  const [subject, setSubject] = useState('');
  const [contentHash, setContentHash] = useState('');
  const [pqcSigHash, setPqcSigHash] = useState('');
  const [metadataURI, setMetadataURI] = useState('');

  const { writeContract, data: hash, isPending, reset } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  useEffect(() => {
    if (isSuccess && hash) {
      toast.success('Attestation issued on-chain', {
        description: `Tx: ${hash.slice(0, 10)}…`,
      });
      reset();
    }
  }, [isSuccess, hash, reset]);

  const fillDemo = () => {
    if (!address) {
      toast.error('Connect your wallet first');
      return;
    }
    const demoSubjectId = subjectId || 'alice@example.com';
    const demoContent =
      content ||
      JSON.stringify({
        type: 'professional-credential',
        title: 'Certified Quantum-Safe Engineer',
        issuedBy: address,
      });

    const { sigHash } = generateDemoPqcKeyMaterial(address);
    setSubjectId(demoSubjectId);
    setContent(demoContent);
    setSubject(hashSubject(demoSubjectId));
    setContentHash(hashAttestationContent(demoContent));
    setPqcSigHash(sigHash);
    setMetadataURI('ipfs://demo-attestation-metadata');
    toast.message('Demo attestation fields filled');
  };

  const issue = () => {
    if (!isRegistryConfigured) {
      toast.error('Set NEXT_PUBLIC_REGISTRY_ADDRESS in .env.local');
      return;
    }
    if (!subject || !contentHash || !pqcSigHash) {
      toast.error('Fill subject, content hash, and PQC signature hash');
      return;
    }

    writeContract(
      {
        address: PQC_ATTESTATION_REGISTRY_ADDRESS,
        abi: pqcAttestationRegistryAbi,
        functionName: 'issueAttestation',
        args: [
          subject as `0x${string}`,
          contentHash as `0x${string}`,
          pqcSigHash as `0x${string}`,
          metadataURI || '',
        ],
      },
      {
        onError: (err) => toast.error('Issuance failed', { description: err.shortMessage }),
      },
    );
    toast.message('Confirm in your wallet');
  };

  const busy = isPending || isConfirming;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <FileBadge2 className="h-5 w-5 text-teal-700 dark:text-teal-400" />
          <CardTitle>2. Issue Attestation</CardTitle>
        </div>
        <CardDescription>
          Anchor a verifiable claim (credential, compliance record, supply chain proof) with PQC
          signature and content hashes. Requires ISSUER_ROLE and a registered PQC key.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="subject-id">Subject identifier</Label>
            <Input
              id="subject-id"
              placeholder="alice@example.com or DID"
              value={subjectId}
              onChange={(e) => {
                setSubjectId(e.target.value);
                if (e.target.value) setSubject(hashSubject(e.target.value));
              }}
            />
          </div>
          <div>
            <Label htmlFor="metadata-uri">Metadata URI</Label>
            <Input
              id="metadata-uri"
              placeholder="ipfs://…"
              value={metadataURI}
              onChange={(e) => setMetadataURI(e.target.value)}
            />
          </div>
        </div>
        <div>
          <Label htmlFor="attestation-content">Attestation content (hashed on submit)</Label>
          <Input
            id="attestation-content"
            placeholder='{"type":"credential",…}'
            value={content}
            onChange={(e) => {
              setContent(e.target.value);
              if (e.target.value) setContentHash(hashAttestationContent(e.target.value));
            }}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <HashField label="Subject hash" value={subject} onChange={setSubject} />
          <HashField label="Content hash" value={contentHash} onChange={setContentHash} />
          <HashField label="PQC sig hash" value={pqcSigHash} onChange={setPqcSigHash} />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={fillDemo} variant="outline" disabled={!address}>
            Fill demo fields
          </Button>
          <Button onClick={issue} disabled={busy || !address}>
            {busy ? 'Confirming…' : 'Issue on-chain'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function HashField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <Label>{label}</Label>
      <Input
        placeholder="0x…"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="font-mono text-xs"
      />
    </div>
  );
}