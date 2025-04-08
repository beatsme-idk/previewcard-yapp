import React, { useState, useEffect, useCallback } from 'react';
import { useAccount } from 'wagmi';
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, CheckCircle, AlertCircle, Copy, ExternalLink } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { PreviewData } from '@/lib/types';

// Storage key for existing JSON
const STORAGE_KEY_EXISTING_JSON = 'previewcard_existing_json';

interface EnsUpdaterProps {
  previewData: PreviewData | null;
}

const EnsUpdater: React.FC<EnsUpdaterProps> = ({ previewData }) => {
  const { address, isConnected } = useAccount();
  const { toast } = useToast();
  const [hasCopied, setHasCopied] = useState(false);
  const [existingJson, setExistingJson] = useState('');
  const [parsedJson, setParsedJson] = useState<any>({});
  const [jsonError, setJsonError] = useState<string | null>(null);
  
  const previewUrl = previewData?.baseUrl || '';

  // Load existing JSON from localStorage on component mount
  useEffect(() => {
    try {
      const savedJson = localStorage.getItem(STORAGE_KEY_EXISTING_JSON);
      if (savedJson) {
        setExistingJson(savedJson);
      }
    } catch (error) {
      console.error('Failed to load existing JSON from localStorage:', error);
    }
  }, []);

  // Safely parse JSON when existingJson changes
  useEffect(() => {
    if (!existingJson.trim()) {
      setParsedJson({});
      setJsonError(null);
      return;
    }

    try {
      const parsed = JSON.parse(existingJson);
      setParsedJson(parsed);
      setJsonError(null);
      
      // Save valid JSON to localStorage
      localStorage.setItem(STORAGE_KEY_EXISTING_JSON, existingJson);
    } catch (err) {
      console.warn('Invalid JSON input:', err);
      // Don't change parsedJson on error
      setJsonError('Invalid JSON format. Please check your input.');
    }
  }, [existingJson]);
  
  // Create JSON with preview URL
  const getUpdatedJson = useCallback(() => {
    if (!previewUrl) return '';
    
    // Create a new object to avoid mutating the state directly
    const updatedData = {
      ...parsedJson,
      og: {
        ...(parsedJson.og || {}),
        baseUrl: previewUrl
      }
    };
    
    return JSON.stringify(updatedData, null, 2);
  }, [parsedJson, previewUrl]);
  
  // Format JSON for display
  const formatJsonForDisplay = useCallback((): string => {
    if (!previewUrl) return '// Generate a preview URL first';
    return getUpdatedJson();
  }, [previewUrl, getUpdatedJson]);
  
  // Handle copy to clipboard
  const handleCopy = useCallback(() => {
    const jsonToCopy = getUpdatedJson();
    if (!jsonToCopy) {
      toast({
        title: "Nothing to copy",
        description: "Please generate a preview URL first.",
        variant: "destructive"
      });
      return;
    }
    
    navigator.clipboard.writeText(jsonToCopy).then(
      () => {
        setHasCopied(true);
        toast({
          title: "Copied to clipboard",
          description: "JSON record has been copied to your clipboard.",
        });
        
        // Reset copy state after a delay
        setTimeout(() => setHasCopied(false), 2000);
      },
      (err) => {
        console.error('Failed to copy: ', err);
        toast({
          title: "Copy failed",
          description: "Could not copy to clipboard. Please try again.",
          variant: "destructive"
        });
      }
    );
  }, [getUpdatedJson, toast]);

  // Handle text input change safely
  const handleTextChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    // Just update the text value, parsing happens in the useEffect
    setExistingJson(e.target.value);
  }, []);

  // Handle clear existing JSON
  const handleClearJson = useCallback(() => {
    setExistingJson('');
    setParsedJson({});
    setJsonError(null);
    localStorage.removeItem(STORAGE_KEY_EXISTING_JSON);
    
    toast({
      title: "JSON Cleared",
      description: "Existing JSON has been cleared.",
    });
  }, [toast]);

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Update ENS Record Manually</CardTitle>
        <CardDescription>
          Copy this JSON and update your ENS name's me.yodl text record manually
          through your ENS dashboard.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!isConnected ? (
           <Alert>
             <AlertCircle className="h-4 w-4" />
             <AlertTitle>Note</AlertTitle>
             <AlertDescription>
               You don't need to connect a wallet to view and copy the JSON.
             </AlertDescription>
           </Alert>
        ) : null}
        <>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Label htmlFor="existingJson">Current JSON (Optional)</Label>
                {existingJson && (
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={handleClearJson} 
                    className="h-6 px-2 text-xs"
                  >
                    Clear
                  </Button>
                )}
              </div>
              <textarea
                id="existingJson"
                value={existingJson}
                onChange={handleTextChange}
                placeholder="Paste your existing me.yodl record here (if any)"
                className="w-full h-24 p-2 font-mono text-xs border rounded-md"
              />
              <div className="text-xs">
                {jsonError ? (
                  <p className="text-destructive">{jsonError}</p>
                ) : (
                  <p className="text-muted-foreground">
                    If you already have a me.yodl record, paste it here to preserve your existing data
                  </p>
                )}
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

            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Label htmlFor="jsonToUpdate">Record Value to Copy</Label>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopy}
                  disabled={!previewUrl || !!jsonError}
                  className="h-8 gap-1"
                >
                  {hasCopied ? (
                    <>
                      <CheckCircle className="h-4 w-4" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4" />
                      Copy
                    </>
                  )}
                </Button>
              </div>
              <div className="relative font-mono text-xs p-3 bg-muted rounded-md overflow-auto max-h-48">
                <pre className="whitespace-pre-wrap break-all">
                  {jsonError ? '// Fix JSON error before previewing' : formatJsonForDisplay()}
                </pre>
              </div>
            </div>

            <Alert className="mt-4">
              <AlertTitle className="font-medium">Manual Update Instructions</AlertTitle>
              <AlertDescription className="mt-2">
                <ol className="list-decimal pl-5 space-y-1 text-sm">
                  <li>Copy the JSON above</li>
                  <li>Go to <a 
                      href="https://app.ens.domains/" 
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline inline-flex items-center"
                    >
                      ENS App <ExternalLink className="h-3 w-3 ml-0.5" />
                    </a> or <a 
                      href="https://justaname.id/" 
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline inline-flex items-center"
                    >
                      Justaname <ExternalLink className="h-3 w-3 ml-0.5" />
                    </a>
                  </li>
                  <li>Connect the wallet that owns your ENS name</li>
                  <li>Navigate to your profile or ENS name</li>
                  <li>Click "Edit" and then find the "Records" or "Text Records" section</li>
                  <li>Add a new record with key <code className="bg-gray-200 px-1 rounded">me.yodl</code></li>
                  <li>Paste the copied JSON in the value field</li>
                  <li>Save your changes</li>
                </ol>
              </AlertDescription>
            </Alert>
        </>
      </CardContent>
      <CardFooter className="flex flex-col items-stretch gap-4">
        <Button
          onClick={handleCopy}
          disabled={!previewUrl || !!jsonError}
        >
          {hasCopied ? (
            <>
              <CheckCircle className="mr-2 h-4 w-4" />
              Copied to Clipboard
            </>
          ) : (
            <>
              <Copy className="mr-2 h-4 w-4" />
              Copy JSON Record
            </>
          )}
        </Button>
      </CardFooter>
    </Card>
  );
};

export default EnsUpdater; 