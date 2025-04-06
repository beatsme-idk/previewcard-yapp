import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ENSRecord, PreviewData } from '@/lib/types';
import { Copy, Check, Code, ExternalLink, Loader2, Info, AlertCircle } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';
import { ENSService } from '@/lib/ensService';
import { useAccount } from 'wagmi';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import useWalletProvider from '@/hooks/useWalletProvider';

interface JsonEditorProps {
  previewData: PreviewData | null;
}

const JsonEditor: React.FC<JsonEditorProps> = ({ previewData }) => {
  const { toast } = useToast();
  const { address, isConnected } = useAccount();
  const walletProvider = useWalletProvider();
  
  const [ensRecord, setEnsRecord] = useState<ENSRecord>({
    tokenSymbols: ["USDT", "USDC"],
  });
  const [editableJson, setEditableJson] = useState<string>("");
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<"yodl" | "ens">("yodl");
  const [loading, setLoading] = useState(false);
  const [ensName, setEnsName] = useState<string | null>(null);
  const [currentRecord, setCurrentRecord] = useState<string | null>(null);
  const [parsedCurrentRecord, setParsedCurrentRecord] = useState<any>(null);
  const [fetchingRecords, setFetchingRecords] = useState(false);
  
  const [ensService] = useState(() => new ENSService(walletProvider));
  
  useEffect(() => {
    if (walletProvider) {
      ensService.updateProvider(walletProvider);
    }
  }, [walletProvider, ensService]);

  // Update JSON when previewData changes but preserve existing fields
  useEffect(() => {
    if (previewData?.baseUrl) {
      setEnsRecord(prev => {
        const updatedRecord = {
          ...prev,
          og: {
            baseUrl: previewData.baseUrl
          }
        };
        return updatedRecord;
      });
      
      // Only update editable JSON if we don't have current record yet
      if (!currentRecord) {
        setEditableJson(JSON.stringify(ensRecord, null, 2));
      }
    }
  }, [previewData, currentRecord]);

  // Fetch ENS or JustaName records when wallet is connected
  useEffect(() => {
    const fetchRecords = async () => {
      if (isConnected && address) {
        setFetchingRecords(true);
        try {
          // Try to get ENS name first
          const name = await ensService.getENSNameForAddress(address);
          setEnsName(name);
          
          if (name) {
            // If ENS name found, get its records
            const record = await ensService.getTextRecord(name, 'me.yodl');
            setCurrentRecord(record);
            
            if (record) {
              try {
                const parsed = JSON.parse(record);
                setParsedCurrentRecord(parsed);
                
                // Preserve all existing fields while updating og.baseUrl
                const updatedRecord = {
                  ...parsed,
                  og: previewData?.baseUrl 
                    ? { ...parsed.og, baseUrl: previewData.baseUrl } 
                    : parsed.og
                };
                
                setEnsRecord(updatedRecord);
                setEditableJson(JSON.stringify(updatedRecord, null, 2));
                
                toast({
                  title: "Existing record found",
                  description: "Your current ENS record fields will be preserved when updating",
                });
              } catch (e) {
                console.warn('Invalid JSON in ENS record:', e);
                // Set default record with preview data but preserve any valid parts
                if (previewData?.baseUrl) {
                  const defaultRecord = {
                    tokenSymbols: ["USDT", "USDC"],
                    og: { baseUrl: previewData.baseUrl }
                  };
                  setEnsRecord(defaultRecord);
                  setEditableJson(JSON.stringify(defaultRecord, null, 2));
                }
              }
            } else if (previewData?.baseUrl) {
              // No existing record, set default
              const defaultRecord = {
                tokenSymbols: ["USDT", "USDC"],
                og: { baseUrl: previewData.baseUrl }
              };
              setEnsRecord(defaultRecord);
              setEditableJson(JSON.stringify(defaultRecord, null, 2));
            }
          } else {
            // No ENS name, could be a JustaName user or no name at all
            // For now, just set default record, but could be extended to check JustaName
            if (previewData?.baseUrl) {
              const defaultRecord = {
                tokenSymbols: ["USDT", "USDC"],
                og: { baseUrl: previewData.baseUrl }
              };
              setEnsRecord(defaultRecord);
              setEditableJson(JSON.stringify(defaultRecord, null, 2));
            }
          }
        } catch (error) {
          console.error('Error fetching name records:', error);
          toast({
            title: "Error fetching records",
            description: "Could not retrieve your ENS or JustaName information",
            variant: "destructive"
          });
        } finally {
          setFetchingRecords(false);
        }
      } else if (!isConnected) {
        // Reset all state when wallet is disconnected
        setEnsName(null);
        setCurrentRecord(null);
        setParsedCurrentRecord(null);
        
        // Reset to default record with preview URL if available
        if (previewData?.baseUrl) {
          const defaultRecord = {
            tokenSymbols: ["USDT", "USDC"],
            og: { baseUrl: previewData.baseUrl }
          };
          setEnsRecord(defaultRecord);
          setEditableJson(JSON.stringify(defaultRecord, null, 2));
        }
      }
    };
    
    fetchRecords();
  }, [address, isConnected, previewData, ensService, toast]);

  const handleJsonChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setEditableJson(e.target.value);
    try {
      const parsed = JSON.parse(e.target.value);
      setEnsRecord(parsed);
    } catch (error) {
      // Invalid JSON, but we still update the text area
    }
  };

  const handleCopyJson = () => {
    navigator.clipboard.writeText(editableJson);
    setCopied(true);
    toast({ title: "JSON copied to clipboard" });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleUpdateENS = async () => {
    if (!isConnected) {
      toast({
        title: "Wallet not connected",
        description: "Please connect your wallet first",
        variant: "destructive"
      });
      return;
    }
    
    if (!ensName) {
      toast({
        title: "No ENS name found",
        description: "Your wallet address has no associated ENS name",
        variant: "destructive"
      });
      return;
    }
    
    setLoading(true);
    try {
      await ensService.connectSigner();
      const success = await ensService.updateOgCardRecord(ensName, ensRecord);
      
      if (success) {
        toast({
          title: "ENS record updated",
          description: `Successfully updated me.yodl record for ${ensName}`,
          variant: "default"
        });
        
        // Refresh the current record after successful update
        const updatedRecord = await ensService.getTextRecord(ensName, 'me.yodl');
        setCurrentRecord(updatedRecord);
        if (updatedRecord) {
          try {
            setParsedCurrentRecord(JSON.parse(updatedRecord));
          } catch (e) {
            console.warn('Invalid JSON in updated ENS record');
          }
        }
      } else {
        toast({
          title: "Update failed",
          description: "Failed to update ENS record. Please try again.",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Error updating ENS record:', error);
      toast({
        title: "Update error",
        description: "An error occurred while updating the ENS record",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  // Compare loaded record with current state to highlight changes
  const renderRecordDifferences = () => {
    if (!parsedCurrentRecord) return null;
    
    try {
      const currentJson = JSON.parse(editableJson);
      
      // Check if there are changes to highlight
      const hasChanges = JSON.stringify(parsedCurrentRecord) !== JSON.stringify(currentJson);
      
      if (!hasChanges) return null;
      
      return (
        <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-md">
          <div className="flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />
            <div className="text-sm">
              <p className="font-medium text-amber-700">You've made changes to the record</p>
              <p className="text-amber-600">
                Make sure to review your changes before updating.
              </p>
            </div>
          </div>
        </div>
      );
    } catch (e) {
      return null;
    }
  };

  return (
    <Card className="w-full card-highlight">
      <CardHeader>
        <CardTitle className="flex items-center">
          <Code className="mr-2 h-5 w-5" />
          ENS Record Editor
        </CardTitle>
        <CardDescription>
          Update your me.yodl record with your preview card URL
          {ensName && (
            <span className="block mt-1 font-medium">Connected to: {ensName}</span>
          )}
        </CardDescription>
      </CardHeader>
      
      <CardContent>
        <Tabs defaultValue="yodl" value={activeTab} onValueChange={(value) => setActiveTab(value as "yodl" | "ens")}>
          <TabsList className="grid grid-cols-2 mb-4">
            <TabsTrigger value="yodl">Yodl Subdomain</TabsTrigger>
            <TabsTrigger value="ens">Custom ENS Domain</TabsTrigger>
          </TabsList>
          
          <TabsContent value="yodl" className="space-y-4">
            <div className="bg-card rounded-md p-4">
              <h3 className="text-sm font-medium mb-2">JustaName Integration</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Copy this JSON and paste it into your JustaName profile editor under Custom
              </p>
              
              {fetchingRecords ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin mr-2" />
                  <span>Fetching existing records...</span>
                </div>
              ) : (
                <>
                  {currentRecord && (
                    <div className="p-3 bg-blue-50 border border-blue-200 rounded-md mb-4 text-sm">
                      <div className="flex items-start gap-2">
                        <Info className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="font-medium text-blue-700">Existing record found</p>
                          <p className="text-blue-600">
                            Your existing fields have been preserved. The editor below includes both 
                            your current records and the new og.baseUrl.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  <div className="relative">
                    <textarea
                      className="w-full h-64 bg-muted p-4 rounded-md font-mono text-sm resize-none"
                      value={editableJson}
                      onChange={handleJsonChange}
                      spellCheck="false"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      className="absolute top-2 right-2"
                      onClick={handleCopyJson}
                    >
                      {copied ? (
                        <><Check className="h-4 w-4 mr-1" /> Copied</>
                      ) : (
                        <><Copy className="h-4 w-4 mr-1" /> Copy</>
                      )}
                    </Button>
                  </div>
                  
                  {renderRecordDifferences()}
                  
                  {currentRecord && (
                    <Accordion type="single" collapsible className="mt-4">
                      <AccordionItem value="current-record">
                        <AccordionTrigger className="text-sm">
                          View current record
                        </AccordionTrigger>
                        <AccordionContent>
                          <div className="bg-muted p-2 rounded-md font-mono text-xs max-h-32 overflow-auto whitespace-pre">
                            {JSON.stringify(parsedCurrentRecord, null, 2)}
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    </Accordion>
                  )}
                  
                  <div className="mt-4 space-y-2 text-sm">
                    <h4 className="font-medium">How to update your record:</h4>
                    <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                      <li>Log in to JustaName with your Yodl subdomain wallet</li>
                      <li>Navigate to Profile &gt; Edit Profile &gt; Custom</li>
                      <li>Paste the JSON above into the editor</li>
                      <li>Save your changes</li>
                    </ol>
                    
                    <a 
                      href="https://app.justaname.io/profile" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="flex items-center text-primary text-sm mt-2"
                    >
                      <ExternalLink className="h-3 w-3 mr-1" /> Open JustaName
                    </a>
                  </div>
                </>
              )}
            </div>
          </TabsContent>
          
          <TabsContent value="ens" className="space-y-4">
            <div className="bg-card rounded-md p-4">
              <h3 className="text-sm font-medium mb-2">ENS Domains Integration</h3>
              <p className="text-sm text-muted-foreground mb-4">
                {isConnected 
                  ? ensName 
                    ? `Update the me.yodl record for ${ensName}`
                    : "No ENS name found for your wallet"
                  : "Connect your wallet to update your ENS domain"
                }
              </p>
              
              {fetchingRecords ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin mr-2" />
                  <span>Fetching existing records...</span>
                </div>
              ) : (
                <>
                  {currentRecord && (
                    <div className="p-3 bg-blue-50 border border-blue-200 rounded-md mb-4 text-sm">
                      <div className="flex items-start gap-2">
                        <Info className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="font-medium text-blue-700">Existing record found</p>
                          <p className="text-blue-600">
                            When updating, your existing fields (like tokenSymbols) will be preserved.
                            Only the og.baseUrl value will be updated.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  <div className="relative">
                    <textarea
                      className="w-full h-64 bg-muted p-4 rounded-md font-mono text-sm resize-none"
                      value={editableJson}
                      onChange={handleJsonChange}
                      spellCheck="false"
                      disabled={!isConnected || !ensName}
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      className="absolute top-2 right-2"
                      onClick={handleCopyJson}
                    >
                      {copied ? (
                        <><Check className="h-4 w-4 mr-1" /> Copied</>
                      ) : (
                        <><Copy className="h-4 w-4 mr-1" /> Copy</>
                      )}
                    </Button>
                  </div>
                  
                  {renderRecordDifferences()}
                  
                  {currentRecord && (
                    <Accordion type="single" collapsible className="mt-4">
                      <AccordionItem value="current-record">
                        <AccordionTrigger className="text-sm">
                          View current record
                        </AccordionTrigger>
                        <AccordionContent>
                          <div className="bg-muted p-2 rounded-md font-mono text-xs max-h-32 overflow-auto whitespace-pre">
                            {JSON.stringify(parsedCurrentRecord, null, 2)}
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    </Accordion>
                  )}
                  
                  <Button
                    className="w-full mt-4"
                    onClick={handleUpdateENS}
                    disabled={!isConnected || !ensName || loading}
                  >
                    {loading ? (
                      <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Updating...</>
                    ) : (
                      "Update ENS Record"
                    )}
                  </Button>
                  
                  {!isConnected && (
                    <p className="text-sm text-muted-foreground mt-2">
                      You need to connect your wallet to update your ENS record
                    </p>
                  )}
                  
                  {isConnected && !ensName && (
                    <p className="text-sm text-muted-foreground mt-2">
                      No ENS name was found for your connected wallet address
                    </p>
                  )}
                  
                  <div className="mt-4 space-y-2 text-sm">
                    <h4 className="font-medium">About ENS Text Records:</h4>
                    <p className="text-muted-foreground">
                      This will update the <code>me.yodl</code> text record for your ENS domain,
                      which is used by Yodl and other dApps to display your profile information.
                    </p>
                    
                    <a 
                      href="https://app.ens.domains/" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="flex items-center text-primary text-sm mt-2"
                    >
                      <ExternalLink className="h-3 w-3 mr-1" /> Manage your ENS domains
                    </a>
                  </div>
                </>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
      
      <CardFooter className="flex justify-between">
        <p className="text-xs text-muted-foreground">
          {isConnected 
            ? ensName 
              ? `Connected to: ${ensName}` 
              : "No ENS name associated with your wallet"
            : "Connect your wallet to update ENS records directly"
          }
        </p>
      </CardFooter>
    </Card>
  );
};

export default JsonEditor;
