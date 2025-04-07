import React, { useState, useEffect } from 'react';
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useReadContract } from 'wagmi';
import { mainnet } from 'wagmi/chains';
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, CheckCircle, AlertCircle, ExternalLink, RefreshCw, Info } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { zeroAddress, Address, Hash, namehash, getAddress } from 'viem';
import { normalize } from 'viem/ens';
import { config } from '@/lib/rainbowkit';
import { PreviewData } from '@/lib/types';

// Read ABI for the ENS Public Resolver
const ensResolverReadAbi = [
  {
    inputs: [
      { internalType: 'bytes32', name: 'node', type: 'bytes32' },
      { internalType: 'string', name: 'key', type: 'string' },
    ],
    name: 'text',
    outputs: [{ internalType: 'string', name: '', type: 'string' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

// Write ABI for the ENS Public Resolver
const ensResolverWriteAbi = [
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

// Well-known ENS public resolver addresses
const KNOWN_RESOLVERS = [
  '0x4976fb03C32e5B8cfe2b6cCB31c09Ba78EBaBa41', // ENS Public Resolver (old)
  '0x231b0Ee14048e9dCcD1d247744d114a4EB5E8E63', // ENS Public Resolver
  '0x112234455c3a32fd11230c42e7bccd4a84e02010', // ENS Public Resolver
  '0x226159d592e2b063810a10ebf6dcbada94ed68b8', // JustaName Resolver
  '0xdba48394d77ed167f4e8d49850bd3c216c2c95df', // Yodl Resolver
];

interface EnsUpdaterProps {
  previewData: PreviewData | null;
}

const EnsUpdater: React.FC<EnsUpdaterProps> = ({ previewData }) => {
  const { address, isConnected } = useAccount();
  const { toast } = useToast();
  const [ensName, setEnsName] = useState('');
  const [recordKey] = useState('me.yodl'); // Fixed record key for Yodl
  const [isLoadingResolver, setIsLoadingResolver] = useState(false);
  const [resolverAddress, setResolverAddress] = useState<Address | null>(null);
  const [resolverError, setResolverError] = useState<string | null>(null);
  const [existingData, setExistingData] = useState<string>('');
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [nodeHash, setNodeHash] = useState<`0x${string}` | null>(null);
  
  const previewUrl = previewData?.baseUrl || '';

  // For writing records
  const {
    data: hash,
    error: writeError,
    isPending: isWritePending,
    writeContract,
  } = useWriteContract();

  // For reading records
  const { 
    data: existingRecord, 
    error: readError,
    refetch: refetchRecord,
    isFetching: isFetchingRecord
  } = useReadContract({
    address: resolverAddress as Address | undefined,
    abi: ensResolverReadAbi,
    functionName: 'text',
    args: resolverAddress && nodeHash ? [nodeHash, recordKey] : undefined,
    chainId: mainnet.id,
    query: {
      enabled: !!resolverAddress && !!nodeHash,
    },
  });

  const {
    isLoading: isConfirming,
    isSuccess: isConfirmed,
    error: confirmationError,
  } = useWaitForTransactionReceipt({ hash });

  // Function to fetch resolver address
  const fetchResolver = async (name: string) => {
    if (!name) return;
    
    setIsLoadingResolver(true);
    setResolverError(null);
    setResolverAddress(null);
    setNodeHash(null);
    setExistingData('');
    
    try {
      // Normalize the name and get the namehash
      const normalizedName = normalize(name);
      const node = namehash(normalizedName);
      setNodeHash(node);
      
      console.log(`Processing ENS name: ${normalizedName}`);
      console.log(`Namehash: ${node}`);
      
      // Get resolver from chain lookup
      // For reliable verification, check all well-known resolvers
      for (const knownResolver of KNOWN_RESOLVERS) {
        try {
          console.log(`Checking resolver: ${knownResolver}`);
          
          // Use a checksummed address
          const checksummedAddress = getAddress(knownResolver);
          
          // Make sure the resolver has text capabilities
          const hasText = await checkResolverHasText(checksummedAddress, node);
          
          if (hasText) {
            console.log(`Found working resolver: ${checksummedAddress}`);
            setResolverAddress(checksummedAddress);
            return;
          }
        } catch (err) {
          console.log(`Resolver ${knownResolver} check failed`);
        }
      }
      
      // If we get here, no resolver was found
      throw new Error('No working resolver found for this name. Are you sure this is a valid ENS name?');
    } catch (err: any) {
      console.error('Error processing ENS name:', err);
      setResolverError(err.message || 'Failed to find resolver. Ensure the name is correct and registered.');
    } finally {
      setIsLoadingResolver(false);
    }
  };
  
  // Helper function to check if a resolver supports the text method
  const checkResolverHasText = async (resolverAddress: Address, node: `0x${string}`): Promise<boolean> => {
    try {
      const result = await fetch(`https://eth-mainnet.g.alchemy.com/v2/demo/checkResolverRecord`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'eth_call',
          params: [{
            to: resolverAddress,
            data: `0x59d1d43c${node.substring(2).padStart(64, '0')}${Buffer.from('me.yodl').toString('hex').padStart(64, '0')}`
          }, 'latest']
        })
      }).then(r => r.json());
      
      // If we get a valid response, the resolver supports text records
      return !!result?.result && result.result !== '0x';
    } catch (err) {
      console.error('Error checking resolver text support:', err);
      return false;
    }
  };

  // Debounce fetching resolver
  useEffect(() => {
    const handler = setTimeout(() => {
      if (ensName.includes('.')) { // Basic validation
          fetchResolver(ensName);
      } else {
          setResolverAddress(null);
          setNodeHash(null);
          setResolverError(null);
          setExistingData('');
      }
    }, 500); // Debounce time

    return () => {
      clearTimeout(handler);
    };
  }, [ensName]);
  
  // When resolver and nodeHash are set, load existing data
  useEffect(() => {
    if (existingRecord && typeof existingRecord === 'string') {
      try {
        const trimmed = existingRecord.trim();
        // Set raw text, even if it's not valid JSON
        setExistingData(trimmed);
      } catch (err) {
        console.error('Error parsing existing record:', err);
        // Still set it as is, we'll handle validation later
        setExistingData(existingRecord);
      }
    }
  }, [existingRecord]);

  // Refresh the existing record data
  const handleRefreshExistingData = () => {
    if (resolverAddress && nodeHash) {
      refetchRecord();
    }
  };

  // Construct the updated JSON with the preview URL
  const constructUpdatedJson = (): string => {
    let updatedData: any = {};
    
    // Try to parse existing data if available
    if (existingData) {
      try {
        updatedData = JSON.parse(existingData);
      } catch (err) {
        console.warn('Existing data is not valid JSON, will create new object');
        // If not valid JSON, we'll create a new object
      }
    }
    
    // Add/update the og section with the baseUrl
    updatedData.og = {
      ...updatedData.og,
      baseUrl: previewUrl
    };
    
    return JSON.stringify(updatedData);
  };

  const handleUpdateEns = async () => {
    if (!isConnected || !address) {
      toast({ title: "Connect Wallet", description: "Please connect your wallet.", variant: "destructive" });
      return;
    }
    
    if (!ensName || !previewUrl) {
      toast({ 
        title: "Missing Information", 
        description: "Please provide an ENS name and ensure a preview URL is generated.", 
        variant: "destructive" 
      });
      return;
    }
    
    if (!resolverAddress || !nodeHash) {
      toast({ 
        title: "Resolver Error", 
        description: resolverError || "Cannot update: ENS name resolver not found.", 
        variant: "destructive" 
      });
      return;
    }
    
    // Construct the updated JSON
    const updatedValue = constructUpdatedJson();
    
    console.log(`Updating ENS record for ${ensName}:`);
    console.log(`  Resolver: ${resolverAddress}`);
    console.log(`  Key: ${recordKey}`);
    console.log(`  Previous value: ${existingData || '(none)'}`);
    console.log(`  New value: ${updatedValue}`);
    
    writeContract({
      address: resolverAddress,
      abi: ensResolverWriteAbi,
      functionName: 'setText',
      args: [
        nodeHash,
        recordKey,
        updatedValue
      ],
      chain: mainnet,
      account: address
    });
  };

  // Error handling
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

  // Success messaging
  useEffect(() => {
    if (isConfirmed) {
      toast({ 
        title: "Update Successful", 
        description: `ENS record '${recordKey}' for ${ensName} updated successfully.`
      });
      
      // Refresh the data after confirmation
      setTimeout(() => {
        handleRefreshExistingData();
      }, 2000);
    }
  }, [isConfirmed, toast, recordKey, ensName]);

  // Helper for Etherscan links
  const getHashString = (hash: unknown): Hash | undefined => {
    if (typeof hash === 'string' && hash.startsWith('0x')) {
      return hash as Hash;
    }
    return undefined;
  };

  // Format JSON for display
  const formatJsonPreview = (jsonString: string): string => {
    try {
      return JSON.stringify(JSON.parse(jsonString), null, 2);
    } catch {
      return jsonString || 'No data';
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Update ENS Record</CardTitle>
        <CardDescription>
          Update the YODL preview card URL in your ENS name's me.yodl text record.
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
              <div className="flex items-center">
                {isLoadingResolver && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                {resolverAddress ? (
                  <p className="text-sm text-green-600 flex items-center">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Resolver found: {resolverAddress.substring(0,6)}...{resolverAddress.substring(resolverAddress.length-4)}
                  </p>
                ) : resolverError ? (
                  <p className="text-sm text-destructive flex items-center">
                    <AlertCircle className="h-3 w-3 mr-1" />
                    {resolverError}
                  </p>
                ) : ensName ? (
                  <p className="text-sm text-muted-foreground">Enter a valid ENS name</p>
                ) : null}
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Label htmlFor="recordKey">Record Key (Fixed)</Label>
                {resolverAddress && nodeHash && (
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={handleRefreshExistingData}
                    disabled={isFetchingRecord}
                    className="h-6 px-2 text-xs"
                  >
                    {isFetchingRecord ? (
                      <Loader2 className="h-3 w-3 animate-spin mr-1" />
                    ) : (
                      <RefreshCw className="h-3 w-3 mr-1" />
                    )}
                    Refresh data
                  </Button>
                )}
              </div>
              <Input
                id="recordKey"
                value={recordKey}
                disabled={true}
                className="bg-muted"
              />
              <p className="text-xs text-muted-foreground">
                The 'me.yodl' record stores your Yodl profile data
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="existingData">Current Record Data</Label>
              <div className="relative">
                <div 
                  className="font-mono text-xs p-3 bg-muted rounded-md overflow-auto max-h-32"
                >
                  {isFetchingRecord ? (
                    <div className="flex items-center justify-center py-2">
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Loading data...
                    </div>
                  ) : existingData ? (
                    <pre>{formatJsonPreview(existingData)}</pre>
                  ) : resolverAddress && nodeHash ? (
                    <p className="text-muted-foreground italic">No existing data found</p>
                  ) : (
                    <p className="text-muted-foreground italic">Enter an ENS name to view current data</p>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="previewUrl">Preview Card URL</Label>
              <Input
                id="previewUrl"
                value={previewUrl}
                readOnly
                disabled
                className="bg-muted"
              />
              {!previewUrl && (
                <p className="text-sm text-destructive">
                  Generate the preview URL in the previous step first
                </p>
              )}
            </div>

            <div className="bg-blue-50 border border-blue-200 p-3 rounded-md text-sm text-blue-700">
              <div className="font-medium mb-1 flex items-center">
                <Info className="h-4 w-4 mr-1 text-blue-500" />
                Update Preview:
              </div>
              <div className="font-mono text-xs bg-white border border-blue-100 p-2 rounded">
                {existingData && previewUrl ? (
                  <pre>{formatJsonPreview(constructUpdatedJson())}</pre>
                ) : (
                  <p className="text-muted-foreground italic">
                    {!previewUrl 
                      ? "Generate preview URL first" 
                      : "Enter ENS name to see update preview"}
                  </p>
                )}
              </div>
            </div>
          </>
        )}
      </CardContent>
      <CardFooter className="flex flex-col items-stretch gap-4">
         <Button
          onClick={handleUpdateEns}
          disabled={
            !isConnected || 
            !ensName || 
            !previewUrl || 
            !resolverAddress || 
            !nodeHash || 
            isWritePending || 
            isConfirming || 
            isLoadingResolver
          }
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