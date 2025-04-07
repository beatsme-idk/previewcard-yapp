import React, { useState, useEffect } from 'react';
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useChainId } from 'wagmi';
import { mainnet } from 'wagmi/chains'; // Import mainnet chain
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, CheckCircle, AlertCircle, ExternalLink } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { zeroAddress, Address, Hash } from 'viem';
import { normalize } from 'viem/ens';
import { getEnsResolver } from '@wagmi/core';
import { config } from '@/lib/rainbowkit'; // Remove mainnetChainId import
import { PreviewData } from '@/lib/types';

// ABI fragment for the ENS Public Resolver setText function
const ensResolverAbi = [
  {
    inputs: [
      { internalType: 'bytes32', name: 'node', type: 'bytes32' },
      { internalType: 'string', name: 'key', type: 'string' },
      { internalType: 'string', name: 'value', type: 'string' },
    ],
    name: 'setText',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
] as const;

interface EnsUpdaterProps {
  previewData: PreviewData | null;
}

const EnsUpdater: React.FC<EnsUpdaterProps> = ({ previewData }) => {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { toast } = useToast();
  const [ensName, setEnsName] = useState('');
  const [recordKey, setRecordKey] = useState('preview.card'); // Default key
  const [isLoadingResolver, setIsLoadingResolver] = useState(false);
  const [resolverAddress, setResolverAddress] = useState<Address | null>(null);
  const [resolverError, setResolverError] = useState<string | null>(null);

  const {
    data: hash,
    error: writeError,
    isPending: isWritePending,
    writeContract,
  } = useWriteContract();

  const {
    isLoading: isConfirming,
    isSuccess: isConfirmed,
    error: confirmationError,
  } = useWaitForTransactionReceipt({ hash });

  const previewUrl = previewData?.baseUrl || '';

  // Function to fetch resolver address
  const fetchResolver = async (name: string) => {
    if (!name) return;
    setIsLoadingResolver(true);
    setResolverError(null);
    setResolverAddress(null);
    try {
      const normalizedName = normalize(name);
      // Always use mainnet for ENS resolution (mainnet.id === 1)
      console.log(`Fetching resolver for normalized name: ${normalizedName} on mainnet`);
      const resolver = await getEnsResolver(config, { 
        name: normalizedName, 
        chainId: mainnet.id  // Use mainnet.id which is exactly 1
      });
      console.log(`Fetched resolver address: ${resolver}`);

      if (!resolver || resolver === zeroAddress) {
        throw new Error('No resolver configured for this name, or resolver is set to address zero.');
      }
      setResolverAddress(resolver);
    } catch (err: any) {
      console.error('Error fetching ENS resolver:', err);
      setResolverError(err.message || 'Failed to fetch resolver. Ensure the name is correct and registered.');
    } finally {
      setIsLoadingResolver(false);
    }
  };

  // Debounce fetching resolver
  useEffect(() => {
    const handler = setTimeout(() => {
      if (ensName.includes('.')) { // Basic validation
          fetchResolver(ensName);
      } else {
          setResolverAddress(null);
          setResolverError(null);
      }
    }, 500); // Debounce time: 500ms

    return () => {
      clearTimeout(handler);
    };
    // We removed chainId from dependencies since we're using mainnet.id now
  }, [ensName]);

  const handleUpdateEns = async () => {
    if (!isConnected || !address) {
      toast({ title: "Connect Wallet", description: "Please connect your wallet.", variant: "destructive" });
      return;
    }
    if (!ensName || !recordKey || !previewUrl) {
      toast({ title: "Missing Information", description: "Please provide ENS name, record key, and ensure preview URL is generated.", variant: "destructive" });
      return;
    }
    if (!resolverAddress || resolverAddress === zeroAddress) {
      toast({ title: "Resolver Error", description: resolverError || "Cannot update: ENS name resolver not found or invalid.", variant: "destructive" });
      return;
    }

    console.log(`Attempting to set text record for ${ensName}:`);
    console.log(`  Resolver: ${resolverAddress}`);
    console.log(`  Key: ${recordKey}`);
    console.log(`  Value: ${previewUrl}`);

    writeContract({
      address: resolverAddress,
      abi: ensResolverAbi,
      functionName: 'setText',
      args: [
        normalizeToBytes32(ensName), // Convert to bytes32 for the resolver
        recordKey,
        previewUrl
      ],
      chain: mainnet,
      account: address
    });
  };

  // Helper to convert ENS name to bytes32 for the resolver
  const normalizeToBytes32 = (name: string): `0x${string}` => {
    // This is a helper function that makes TypeScript happy with the types
    // In reality, Viem will convert the name to namehash internally
    return ('0x' + Array.from(normalize(name), c => 
      c.charCodeAt(0).toString(16).padStart(2, '0')).join('')) as `0x${string}`;
  };

  // Display errors
  useEffect(() => {
    if (writeError) {
      toast({ title: "Transaction Error", description: writeError.message || "An unknown transaction error occurred.", variant: "destructive" });
    }
  }, [writeError, toast]);

  useEffect(() => {
    if (confirmationError) {
      toast({ title: "Confirmation Error", description: confirmationError.message || "An unknown confirmation error occurred.", variant: "destructive" });
    }
  }, [confirmationError, toast]);

  // Display success
   useEffect(() => {
    if (isConfirmed) {
      toast({ title: "Update Successful", description: `ENS record '${recordKey}' for ${ensName} updated successfully.`});
    }
  }, [isConfirmed, toast, recordKey, ensName]);

  // Helper to ensure hash is correctly typed for etherscan links
  const getHashString = (hash: unknown): Hash | undefined => {
    if (typeof hash === 'string' && hash.startsWith('0x')) {
      return hash as Hash;
    }
    return undefined;
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Update ENS Record</CardTitle>
        <CardDescription>
          Set a text record on your ENS name to point to your preview card URL.
          Ensure your connected wallet owns the ENS name.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!isConnected ? (
           <Alert variant="destructive">
             <AlertCircle className="h-4 w-4" />
             <AlertTitle>Wallet Not Connected</AlertTitle>
             <AlertDescription>
               Please connect your wallet to update ENS records.
             </AlertDescription>
           </Alert>
        ) : (
          <>
            <div className="space-y-2">
              <Label htmlFor="ensName">ENS Name</Label>
              <Input
                id="ensName"
                placeholder="yourname.eth or yourname.justaname.eth"
                value={ensName}
                onChange={(e) => setEnsName(e.target.value)}
                disabled={isWritePending || isConfirming}
              />
               {isLoadingResolver && <Loader2 className="h-4 w-4 animate-spin ml-2 inline-block text-muted-foreground" />}
               {resolverError && <p className="text-sm text-destructive mt-1">{resolverError}</p>}
               {resolverAddress && resolverAddress !== zeroAddress && !resolverError && (
                 <p className="text-sm text-green-600 mt-1">Resolver found: {resolverAddress.substring(0,6)}...{resolverAddress.substring(resolverAddress.length-4)}</p>
               )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="recordKey">Record Key</Label>
              <Input
                id="recordKey"
                placeholder="e.g., preview.card"
                value={recordKey}
                onChange={(e) => setRecordKey(e.target.value)}
                disabled={isWritePending || isConfirming}
              />
               <p className="text-xs text-muted-foreground">Recommended: `preview.card` or `app.previewcard.url`</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="previewUrl">Preview Card URL (Read-only)</Label>
              <Input
                id="previewUrl"
                value={previewUrl}
                readOnly
                disabled
                className="bg-muted"
              />
               {!previewUrl && <p className="text-sm text-destructive mt-1">Generate the preview URL in the previous step first.</p>}
            </div>
          </>
        )}
      </CardContent>
      <CardFooter className="flex flex-col items-stretch gap-4">
         <Button
          onClick={handleUpdateEns}
          disabled={!isConnected || !ensName || !recordKey || !previewUrl || !resolverAddress || resolverAddress === zeroAddress || isWritePending || isConfirming || isLoadingResolver}
        >
          {isWritePending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {isConfirming && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {isWritePending ? 'Waiting for Signature...' : isConfirming ? 'Confirming Transaction...' : 'Update ENS Record'}
        </Button>

         {isConfirmed && hash && (
          <Alert variant="default" className="bg-green-50 border-green-200 text-green-800">
            <CheckCircle className="h-4 w-4 !text-green-500" />
            <AlertTitle>Update Successful!</AlertTitle>
            <AlertDescription className="break-all">
              Transaction confirmed!{' '}
              {(() => {
                const safeHash = getHashString(hash);
                return safeHash ? (
                  <a
                    href={`https://etherscan.io/tx/${safeHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline hover:text-green-600"
                  >
                    View on Etherscan: {safeHash.substring(0,10)}...{safeHash.substring(safeHash.length-8)}
                    <ExternalLink className="inline-block ml-1 h-3 w-3" />
                  </a>
                ) : null;
              })()}
            </AlertDescription>
          </Alert>
        )}
        {(writeError || confirmationError) && (
            <Alert variant="destructive">
             <AlertCircle className="h-4 w-4" />
             <AlertTitle>Update Failed</AlertTitle>
             <AlertDescription>
                { (writeError?.message || confirmationError?.message || 'An error occurred.') }
                {(() => {
                  const safeHash = getHashString(hash);
                  return safeHash ? (
                    <p className="mt-1 break-all">Transaction Hash: {safeHash}</p>
                  ) : null;
                })()}
             </AlertDescription>
           </Alert>
        )}
      </CardFooter>
    </Card>
  );
};

export default EnsUpdater; 