
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ENSRecord, PreviewData } from '@/lib/types';
import { Copy, Check, Code } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';

interface JsonEditorProps {
  previewData: PreviewData | null;
}

const JsonEditor: React.FC<JsonEditorProps> = ({ previewData }) => {
  const { toast } = useToast();
  const [ensRecord, setEnsRecord] = useState<ENSRecord>({
    tokenSymbols: ["USDT", "USDC"],
  });
  const [editableJson, setEditableJson] = useState<string>("");
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<"yodl" | "ens">("yodl");

  // Update JSON when previewData changes
  useEffect(() => {
    if (previewData?.baseUrl) {
      const updatedRecord = {
        ...ensRecord,
        og: {
          baseUrl: previewData.baseUrl
        }
      };
      setEnsRecord(updatedRecord);
      setEditableJson(JSON.stringify(updatedRecord, null, 2));
    }
  }, [previewData]);

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

  return (
    <Card className="w-full card-highlight">
      <CardHeader>
        <CardTitle className="flex items-center">
          <Code className="mr-2 h-5 w-5" />
          ENS Record Editor
        </CardTitle>
        <CardDescription>
          Update your me.yodl record with your preview card URL
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
              
              <div className="mt-4 space-y-2 text-sm">
                <h4 className="font-medium">How to update your record:</h4>
                <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                  <li>Log in to JustaName with your Yodl subdomain wallet</li>
                  <li>Navigate to Profile > Edit Profile > Custom</li>
                  <li>Paste the JSON above into the editor</li>
                  <li>Save your changes</li>
                </ol>
              </div>
            </div>
            
            <Button className="w-full" disabled>
              Connect Wallet (Coming Soon)
            </Button>
          </TabsContent>
          
          <TabsContent value="ens" className="space-y-4">
            <div className="bg-card rounded-md p-4">
              <h3 className="text-sm font-medium mb-2">ENS Domains Integration</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Copy this JSON to update your custom ENS domain's me.yodl record
              </p>
              
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
              
              <div className="mt-4 space-y-2 text-sm">
                <h4 className="font-medium">How to update your record:</h4>
                <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                  <li>Visit app.ens.domains and connect your wallet</li>
                  <li>Navigate to your ENS domain</li>
                  <li>Add or edit the "me.yodl" record with the JSON above</li>
                  <li>Save your changes</li>
                </ol>
              </div>
            </div>
            
            <Button className="w-full" disabled>
              Connect Wallet (Coming Soon)
            </Button>
          </TabsContent>
        </Tabs>
      </CardContent>
      
      <CardFooter className="flex justify-between">
        <p className="text-xs text-muted-foreground">
          Note: This app does not automatically update your ENS records yet
        </p>
      </CardFooter>
    </Card>
  );
};

export default JsonEditor;
