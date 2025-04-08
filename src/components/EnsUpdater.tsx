import React, { useState, useEffect } from 'react';
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useReadContract, useSignMessage } from 'wagmi';
import { mainnet } from 'wagmi/chains';
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, CheckCircle, AlertCircle, ExternalLink, RefreshCw, Info, Lock } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { Address, Hash, namehash, getAddress } from 'viem';
import { normalize } from 'viem/ens';
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

// Known resolvers for Yodl domains
const YODL_RESOLVER = '0xdba48394d77ed167f4e8d49850bd3c216c2c95df'; // Yodl Resolver
// Justaname API endpoints
const JUSTANAME_API_RECORDS = 'https://api.justaname.id/ens/v1/subname/records';
const JUSTANAME_API_UPDATE = 'https://api.justaname.id/ens/v1/subname/txtrecord';
const PROVIDER_URLS = [
  'https://eth-mainnet.g.alchemy.com/v2/demo',
  'https://mainnet.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161', // Public Infura key
  'https://cloudflare-eth.com'
];

interface EnsUpdaterProps {
  previewData: PreviewData | null;
}

interface JustanameResponse {
  statusCode: number;
  result: {
    data?: {
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
        coins?: Array<{
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
  const [nodeHash, setNodeHash] = useState<`0x${string}` | null>(null);
  const [isJustaname, setIsJustaname] = useState(false);
  const [isUpdatingJustaname, setIsUpdatingJustaname] = useState(false);
  
  const previewUrl = previewData?.baseUrl || '';

  const {
    signMessage,
    data: signatureData,
    isPending: isSignPending,
    isSuccess: isSignSuccess,
    error: signError,
    reset: resetSign
  } = useSignMessage();

  // For reading records
  const { 
    data: existingRecord, 
    error: readError,
    refetch: refetchRecord,
    isFetching: isFetchingRecord,
    isError: isReadError
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

  // Update existing data when record is fetched via contract
  useEffect(() => {
    if (existingRecord && typeof existingRecord === 'string') {
      try {
        const trimmed = existingRecord.trim();
        setExistingData(trimmed);
        console.log(`Loaded existing record via contract: ${trimmed}`);
      } catch (err) {
        console.error('Error parsing existing record:', err);
        setExistingData(existingRecord);
      }
    } else if (isReadError && !existingData) {
      console.log('No existing record found via contract or error reading record');
      // Don't reset existingData here as it might have been set by Justaname API
    }
  }, [existingRecord, isReadError]);

  // Handle signature success for Justaname
  useEffect(() => {
    if (isSignSuccess && signatureData && isUpdatingJustaname) {
      setIsUpdatingJustaname(true);
      
      const updateJustanameRecord = async () => {
        try {
          const updatedValue = constructUpdatedJson();
          
          console.log(`Updating Justaname record with signature: ${signatureData}`);
          
          const response = await fetch(JUSTANAME_API_UPDATE, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              ens: ensName,
              key: recordKey,
              value: updatedValue,
              signature: signatureData,
              address: address
            }),
          });
          
          const data = await response.json();
          console.log('Justaname update response:', data);
          
          if (response.ok && data.statusCode === 200) {
            toast({ 
              title: "Update Successful", 
              description: `ENS record '${recordKey}' for ${ensName} updated successfully via Justaname.`
            });
            
            // Refresh data after update
            setTimeout(() => {
              fetchRecordsFromJustaname(ensName);
            }, 2000);
          } else {
            throw new Error(data.result?.error || 'Failed to update record via Justaname');
          }
        } catch (err: any) {
          console.error('Justaname update error:', err);
          toast({ 
            title: "Justaname Update Failed", 
            description: err.message || "Failed to update record via Justaname.",
            variant: "destructive"
          });
        } finally {
          setIsUpdatingJustaname(false);
          resetSign();
        }
      };
      
      updateJustanameRecord();
    }
  }, [isSignSuccess, signatureData, isUpdatingJustaname]);

  // Function to fetch records from Justaname API
  const fetchRecordsFromJustaname = async (name: string): Promise<boolean> => {
    console.log(`Trying to fetch records for ${name} via Justaname API`);
    
    // Try different provider URLs
    for (const providerUrl of PROVIDER_URLS) {
      try {
        const apiUrl = `${JUSTANAME_API_RECORDS}?ens=${encodeURIComponent(name)}&providerUrl=${encodeURIComponent(providerUrl)}`;
        console.log(`Trying Justaname API with provider: ${providerUrl}`);
        
        const response = await fetch(apiUrl);
        if (!response.ok) {
          console.log(`Provider ${providerUrl} failed with status ${response.status}`);
          continue;
        }
        
        const data: JustanameResponse = await response.json();
        console.log('Justaname API response:', data);
        
        if (data.statusCode === 200 && data.result.data) {
          setIsJustaname(true);
          
          // Set resolver address from response
          const resolver = data.result.data.records.resolverAddress as `0x${string}`;
          console.log(`Found resolver via Justaname: ${resolver}`);
          setResolverAddress(resolver);
          
          // Look for me.yodl record
          const meYodlRecord = data.result.data.records.texts?.find(
            text => text.key === recordKey || text.key === 'me.yodl' || text.key === 'my.yodl'
          );
          
          if (meYodlRecord) {
            console.log(`Found ${meYodlRecord.key} record via Justaname:`, meYodlRecord.value);
            setExistingData(meYodlRecord.value);
          } else {
            console.log(`No ${recordKey} record found via Justaname.`);
          }
          
          return true;
        }
      } catch (err) {
        console.log(`Error with provider ${providerUrl}:`, err);
        // Continue to next provider
      }
    }
    
    console.log('All Justaname provider attempts failed');
    return false;
  };

  // Function to process ENS names
  const processEnsName = async (name: string) => {
    if (!name) return;
    
    setIsLoadingResolver(true);
    setResolverError(null);
    setResolverAddress(null);
    setNodeHash(null);
    setExistingData('');
    setIsJustaname(false);
    
    try {
      console.log(`Processing ENS name: ${name}`);
      
      // Clean up the name - remove any invisible characters that cause issues
      const cleanName = name.trim().replace(/\u200B|\u200C|\u200D|\uFEFF|\u200E|\u200F/g, '');
      console.log(`Processing cleaned name: "${cleanName}"`);

      // Normalize and validate the name
      if (!cleanName.includes('.')) {
        throw new Error('Invalid ENS name: must include at least one dot (.)');
      }

      try {
        // Normalize the name and generate namehash
        const normalizedName = normalize(cleanName);
        const node = namehash(normalizedName);
        console.log(`Generated namehash: ${node}`);
        setNodeHash(node);
        
        // Check if it's a Yodl or Justaname domain
        const isYodlDomain = 
          cleanName.endsWith('.yodl.eth') || 
          cleanName.endsWith('.yodl') || 
          cleanName.includes('.yod');
          
        const isJustanameDomain = 
          cleanName.endsWith('.justaname.eth') || 
          cleanName.endsWith('.justaname') || 
          cleanName.endsWith('.jan.eth') ||
          cleanName.endsWith('.jns.eth');
        
        // Try Justaname API first for all domains
        const justanameFetched = await fetchRecordsFromJustaname(cleanName);
        
        // If Justaname API failed, fall back to direct contract detection
        if (!justanameFetched) {
          if (isYodlDomain) {
            console.log('Falling back to Yodl resolver');
            const yodlResolver = getAddress(YODL_RESOLVER);
            setResolverAddress(yodlResolver);
          } else {
            console.log('Falling back to ENS Public Resolver');
            // Use a default public resolver
            const ensResolver = getAddress('0x231b0Ee14048e9dCcD1d247744d114a4EB5E8E63');
            setResolverAddress(ensResolver);
          }
        }
      } catch (err: any) {
        console.error(`Error normalizing name "${cleanName}":`, err);
        throw new Error(`Invalid ENS name: ${err.message}`);
      }
    } catch (err: any) {
      console.error('Error processing ENS name:', err);
      setResolverError(err.message || 'Failed to process ENS name. Ensure the name is valid.');
    } finally {
      setIsLoadingResolver(false);
    }
  };

  // Debounce processing ENS name
  useEffect(() => {
    if (!ensName) {
      setResolverAddress(null);
      setNodeHash(null);
      setResolverError(null);
      setExistingData('');
      setIsJustaname(false);
      return;
    }
    
    const handler = setTimeout(() => {
      processEnsName(ensName);
    }, 500); // Debounce time

    return () => {
      clearTimeout(handler);
    };
  }, [ensName]);
  
  // Refresh the existing record data
  const handleRefreshExistingData = () => {
    if (!ensName) return;
    
    if (isJustaname) {
      fetchRecordsFromJustaname(ensName);
    } else if (resolverAddress && nodeHash) {
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

  // Helper function to validate namehash format
  const isValidNamehash = (hash: string): boolean => {
    return hash.startsWith('0x') && hash.length === 66; // 0x + 64 hex chars
  };

  // Handle update via Justaname (gasless)
  const handleUpdateViaJustaname = async () => {
    if (!ensName || !previewUrl) {
      toast({ 
        title: "Missing Information", 
        description: "Please provide an ENS name and ensure a preview URL is generated.",
        variant: "destructive" 
      });
      return;
    }
    
    if (!address) {
      toast({ title: "Connect Wallet", description: "Please connect your wallet.", variant: "destructive" });
      return;
    }
    
    // Prepare message to sign
    const updatedValue = constructUpdatedJson();
    const messageToSign = `Update ENS Text Record\n\nDomain: ${ensName}\nKey: ${recordKey}\nValue: ${updatedValue}`;
    
    console.log('Requesting signature for Justaname update:', messageToSign);
    setIsUpdatingJustaname(true);
    
    signMessage({ 
      message: messageToSign,
      account: address
    });
  };

  // Handle direct contract update
  const handleUpdateContract = async () => {
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
    
    console.log(`Updating ENS record for ${ensName} via contract:`);
    console.log(`  Resolver: ${resolverAddress}`);
    console.log(`  Key: ${recordKey}`);
    console.log(`  Node hash: ${nodeHash}`);
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

  // Main update handler
  const handleUpdateEns = () => {
    if (isJustaname) {
      handleUpdateViaJustaname();
    } else {
      handleUpdateContract();
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

  useEffect(() => {
    if (signError) {
      setIsUpdatingJustaname(false);
      toast({ title: "Signature Error", description: signError.message || "Failed to sign message.", variant: "destructive" });
    }
  }, [signError, toast]);

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

  // Get button text based on state
  const getButtonText = () => {
    if (isJustaname) {
      if (isSignPending || isUpdatingJustaname) {
        return 'Waiting for Signature...';
      }
      return 'Update ENS Record (Gasless)';
    } else {
      if (isWritePending) {
        return 'Waiting for Signature...';
      } else if (isConfirming) {
        return 'Confirming Transaction...';
      }
      return 'Update ENS Record';
    }
  };

  // Is the button loading?
  const isButtonLoading = isJustaname 
    ? (isSignPending || isUpdatingJustaname)
    : (isWritePending || isConfirming);

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
                placeholder="yourname.eth or name.yodl.eth"
                value={ensName}
                onChange={(e) => setEnsName(e.target.value)}
                disabled={isButtonLoading}
              />
              <div className="flex items-center">
                {isLoadingResolver && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                {resolverAddress ? (
                  <p className="text-sm text-green-600 flex items-center">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    {isJustaname 
                      ? `Records found for ${ensName} (Justaname Domain)`
                      : `Resolver found for ${ensName}`}
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
                {resolverAddress && (
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={handleRefreshExistingData}
                    disabled={isFetchingRecord || isLoadingResolver}
                    className="h-6 px-2 text-xs"
                  >
                    {(isFetchingRecord || isLoadingResolver) ? (
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
                  {isFetchingRecord || isLoadingResolver ? (
                    <div className="flex items-center justify-center py-2">
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Loading data...
                    </div>
                  ) : existingData ? (
                    <pre>{formatJsonPreview(existingData)}</pre>
                  ) : resolverAddress ? (
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

            {isJustaname && (
              <div className="mt-1">
                <Alert variant="default" className="bg-green-50 border-green-200">
                  <Lock className="h-4 w-4 text-green-500" />
                  <AlertTitle>Gasless Update Available</AlertTitle>
                  <AlertDescription className="text-xs">
                    This is a Justaname domain. You can update records with just a signature - no gas needed!
                  </AlertDescription>
                </Alert>
              </div>
            )}

            <div className="mt-1">
              <Alert variant="default" className="bg-amber-50 border-amber-200">
                <Info className="h-4 w-4 text-amber-500" />
                <AlertTitle>Supported Domains</AlertTitle>
                <AlertDescription className="text-xs">
                  Works with Yodl domains (.yodl.eth), Justaname domains, and standard ENS names.
                </AlertDescription>
              </Alert>
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
            isButtonLoading || 
            isLoadingResolver || 
            isFetchingRecord
          }
          className={isJustaname ? "bg-green-600 hover:bg-green-700" : ""}
        >
          {isButtonLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {!isButtonLoading && isJustaname && <Lock className="mr-2 h-4 w-4" />}
          {getButtonText()}
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
        {(writeError || confirmationError || signError) && (
            <Alert variant="destructive">
             <AlertCircle className="h-4 w-4" />
             <AlertTitle>Update Failed</AlertTitle>
             <AlertDescription>
                { (writeError?.message || confirmationError?.message || signError?.message || 'An error occurred.') }
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