import React, { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, CheckCircle, AlertCircle, Copy, ExternalLink } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { PreviewData } from '@/lib/types';

interface EnsUpdaterProps {
  previewData: PreviewData | null;
}

const EnsUpdater: React.FC<EnsUpdaterProps> = ({ previewData }) => {
  const { address, isConnected } = useAccount();
  const { toast } = useToast();
  const [hasCopied, setHasCopied] = useState(false);
  const [existingJson, setExistingJson] = useState('');
  const [hasEditedJson, setHasEditedJson] = useState(false);
  
  const previewUrl = previewData?.baseUrl || '';

  // Simple JSON constructor for preview URL
  const constructJsonWithPreviewUrl = (existingJson: string): string => {
    let baseData = {};
    
    // Try to parse existing JSON if provided
    if (existingJson.trim()) {
      try {
        baseData = JSON.parse(existingJson);
        setHasEditedJson(true);
      } catch (err) {
        console.warn('Invalid JSON input - starting fresh');
        baseData = {};
        setHasEditedJson(false);
      }
    }
    
    // Add or update og.baseUrl
    const updatedData = {
      ...baseData,
      og: {
        ...(baseData as any).og,
        baseUrl: previewUrl
      }
    };
    
    return JSON.stringify(updatedData, null, 2);
  };
  
  // Format JSON for display
  const formatJsonForDisplay = (): string => {
    if (!previewUrl) return '// Generate a preview URL first';
    return constructJsonWithPreviewUrl(existingJson);
  };
  
  // Handle copy to clipboard
  const handleCopy = () => {
    const jsonToCopy = formatJsonForDisplay();
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
  };

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
           <Alert variant="destructive">
             <AlertCircle className="h-4 w-4" />
             <AlertTitle>Wallet Not Connected</AlertTitle>
             <AlertDescription>
               Please connect your wallet to continue.
             </AlertDescription>
           </Alert>
        ) : (
          <>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Label htmlFor="existingJson">Current JSON (Optional)</Label>
              </div>
              <textarea
                id="existingJson"
                value={existingJson}
                onChange={(e) => setExistingJson(e.target.value)}
                placeholder="Paste your existing me.yodl record here (if any)"
                className="w-full h-24 p-2 font-mono text-xs border rounded-md"
              />
              <p className="text-xs text-muted-foreground">
                If you already have a me.yodl record, paste it here to preserve your existing data
              </p>
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
                  disabled={!previewUrl}
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
                  {formatJsonForDisplay()}
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
        )}
      </CardContent>
      <CardFooter className="flex flex-col items-stretch gap-4">
        <Button
          onClick={handleCopy}
          disabled={!isConnected || !previewUrl}
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