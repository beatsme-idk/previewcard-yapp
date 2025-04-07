import React, { useState, useEffect } from 'react';
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useReadContract } from 'wagmi';
import { mainnet } from 'wagmi/chains';
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, CheckCircle, AlertCircle, ExternalLink, RefreshCw, Info, Link } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { Address, Hash, namehash } from 'viem';
import { normalize } from 'viem/ens';
import { PreviewData } from '@/lib/types';

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

// Justaname API endpoint
const JUSTANAME_API = 'https://api.justaname.id/ens/v1/subname/records';
const PROVIDER_URL = 'https://cloudflare-eth.com';

interface EnsUpdaterProps {
  previewData: PreviewData | null;
}

interface JustanameResponse {
  statusCode: number;
  result: {
    data: {
      ens: string;
      isClaimed: boolean;
      claimedAt: string;
      isJAN: boolean;
      records: {
        resolverAddress: string;
        texts: Array<{
          key: string;
          value: string;
        }>;
        coins: Array<{
          id: number;
          name: string;
          value: string;
        }>;
        contentHash?: {
          protocolType: string;
          decoded: string;
        };
      };
    };
    error?: string;
  };
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

  const {
    isLoading: isConfirming,
    isSuccess: isConfirmed,
    error: confirmationError,
  } = useWaitForTransactionReceipt({ hash });

  // Function to fetch ENS records using Justaname API
  const fetchEnsRecords = async (name: string) => {
    if (!name) return;
    
    setIsLoadingResolver(true);
    setResolverError(null);
    setResolverAddress(null);
    setNodeHash(null);
    setExistingData('');
    
    try {
      console.log(`Fetching records for ENS name: ${name} via Justaname API`);
      
      // Calculate the namehash (still needed for setText)
      const normalizedName = normalize(name);
      const node = namehash(normalizedName);
      console.log(`Generated namehash: ${node}`);
      setNodeHash(node);
      
      // Fetch records from Justaname API
      const apiUrl = `${JUSTANAME_API}?ens=${encodeURIComponent(name)}&providerUrl=${encodeURIComponent(PROVIDER_URL)}`;
      console.log(`Calling API: ${apiUrl}`);
      
      const response = await fetch(apiUrl);
      
      if (!response.ok) {
        throw new Error(`API returned ${response.status}: ${response.statusText}`);
      }
      
      const data: JustanameResponse = await response.json();
      console.log('Justaname API response:', data);
      
      if (data.statusCode !== 200 || data.result.error) {
        throw new Error(data.result.error || 'Failed to fetch records');
      }
      
      // Set resolver address
      const resolver = data.result.data.records.resolverAddress as `0x${string}`;
      console.log(`Found resolver: ${resolver}`);
      setResolverAddress(resolver);
      
      // Look for me.yodl record
      const meYodlRecord = data.result.data.records.texts?.find(text => text.key === recordKey);
      
      if (meYodlRecord) {
        console.log(`Found ${recordKey} record:`, meYodlRecord.value);
        setExistingData(meYodlRecord.value);
      } else {
        console.log(`No ${recordKey} record found.`);
        setExistingData('');
      }
      
    } catch (err: any) {
      console.error('Error fetching ENS records:', err);
      setResolverError(err.message || 'Failed to fetch ENS records. Make sure the name exists.');
    } finally {
      setIsLoadingResolver(false);
    }
  };

  // Debounce fetching resolver
  useEffect(() => {
    const handler = setTimeout(() => {
      if (ensName.includes('.')) { // Basic validation
          fetchEnsRecords(ensName);
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
  
  // Refresh the existing record data
  const handleRefreshExistingData = () => {
    if (ensName) {
      fetchEnsRecords(ensName);
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

  // Helper function to validate namehash format
  const isValidNamehash = (hash: string): boolean => {
    return hash.startsWith('0x') && hash.length === 66; // 0x + 64 hex chars
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

    // Validate the namehash format
    if (!isValidNamehash(nodeHash)) {
      console.error(`Invalid namehash format: ${nodeHash}`);
      toast({
        title: "Invalid Namehash",
        description: "The ENS namehash has an invalid format. Try again with a different ENS name.",
        variant: "destructive"
      });
      return;
    }
    
    // Construct the updated JSON
    const updatedValue = constructUpdatedJson();
    
    console.log(`Updating ENS record for ${ensName}:`);
    console.log(`  Resolver: ${resolverAddress}`);
    console.log(`  Key: ${recordKey}`);
    console.log(`  Node hash: ${nodeHash}`);
    console.log(`  Node hash type: ${typeof nodeHash}`);
    console.log(`  Node hash length: ${nodeHash.length - 2} bytes`); // Subtract 2 for "0x"
    console.log(`  Previous value: ${existingData || '(none)'}`);
    console.log(`  New value: ${updatedValue}`);
    
    try {
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
    } catch (error) {
      console.error("Contract write error:", error);
      toast({ 
        title: "Transaction Error", 
        description: "Failed to send transaction. Check console for details.", 
        variant: "destructive" 
      });
    }
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
                    Records found for {ensName}
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
                    disabled={isLoadingResolver}
                    className="h-6 px-2 text-xs"
                  >
                    {isLoadingResolver ? (
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
                  {isLoadingResolver ? (
                    <div className="flex items-center justify-center py-2">
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Loading data...
                    </div>
                  ) : existingData ? (
                    <pre>{formatJsonPreview(existingData)}</pre>
                  ) : resolverAddress && nodeHash ? (
                    <p className="text-muted-foreground italic">No me.yodl record found - one will be created</p>
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
                {resolverAddress && previewUrl ? (
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

            <div className="flex items-center text-xs text-muted-foreground">
              <Link className="h-3 w-3 mr-1" />
              <span>Data fetched via <a href="https://justaname.id" target="_blank" rel="noopener noreferrer" className="underline">Justaname API</a></span>
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