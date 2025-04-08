import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Copy, CheckCircle, AlertCircle, ExternalLink } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

interface EnsFeaturesProps {
  ensName: string;
}

const EnsFeatures: React.FC<EnsFeaturesProps> = ({ ensName }) => {
  const { toast } = useToast();
  const [redirectUrl, setRedirectUrl] = useState('');
  const [webhookType, setWebhookType] = useState<'whatsapp' | 'x' | ''>('');
  const [webhookUrl, setWebhookUrl] = useState('');
  const [hasCopied, setHasCopied] = useState(false);

  const handleCopyRecord = (key: string, value: string) => {
    navigator.clipboard.writeText(value);
    setHasCopied(true);
    toast({
      title: "Copied to clipboard",
      description: `Record key: ${key}`,
    });
    setTimeout(() => setHasCopied(false), 2000);
  };

  const generateRedirectRecord = () => {
    if (!redirectUrl) return '';
    return JSON.stringify({
      redirect: redirectUrl
    });
  };

  const generateWebhookRecord = () => {
    if (!webhookType || !webhookUrl) return '';
    return JSON.stringify({
      webhooks: {
        [webhookType]: webhookUrl
      }
    });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>ENS Redirect URL</CardTitle>
          <CardDescription>
            Set up a redirect URL for your ENS name. When someone visits your ENS name, they will be redirected to this URL.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="redirectUrl">Redirect URL</Label>
            <Input
              id="redirectUrl"
              value={redirectUrl}
              onChange={(e) => setRedirectUrl(e.target.value)}
              placeholder="https://example.com"
            />
          </div>
          {redirectUrl && (
            <div className="space-y-2">
              <Label>Record to Set</Label>
              <div className="flex items-center gap-2">
                <code className="flex-1 p-2 bg-muted rounded-md text-sm">
                  {generateRedirectRecord()}
                </code>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleCopyRecord('redirect', generateRedirectRecord())}
                >
                  {hasCopied ? (
                    <>
                      <CheckCircle className="mr-2 h-4 w-4" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="mr-2 h-4 w-4" />
                      Copy
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Webhook Notifications</CardTitle>
          <CardDescription>
            Set up webhook notifications for your ENS name. Receive notifications on WhatsApp or X when someone interacts with your ENS name.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Webhook Type</Label>
            <Select value={webhookType} onValueChange={(value: 'whatsapp' | 'x' | '') => setWebhookType(value)}>
              <SelectTrigger>
                <SelectValue placeholder="Select webhook type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="whatsapp">WhatsApp</SelectItem>
                <SelectItem value="x">X (Twitter)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="webhookUrl">Webhook URL</Label>
            <Input
              id="webhookUrl"
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
              placeholder="https://webhook.example.com"
            />
          </div>
          {webhookType && webhookUrl && (
            <div className="space-y-2">
              <Label>Record to Set</Label>
              <div className="flex items-center gap-2">
                <code className="flex-1 p-2 bg-muted rounded-md text-sm">
                  {generateWebhookRecord()}
                </code>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleCopyRecord('webhooks', generateWebhookRecord())}
                >
                  {hasCopied ? (
                    <>
                      <CheckCircle className="mr-2 h-4 w-4" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="mr-2 h-4 w-4" />
                      Copy
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>How to Use</AlertTitle>
        <AlertDescription>
          <ol className="list-decimal pl-5 space-y-1 mt-2">
            <li>Copy the record value for the feature you want to set up</li>
            <li>Go to <a 
                href="https://app.ens.domains/" 
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline inline-flex items-center"
              >
                ENS App <ExternalLink className="h-3 w-3 ml-0.5" />
              </a>
            </li>
            <li>Connect your wallet and navigate to your ENS name</li>
            <li>Add a new text record with the appropriate key (redirect or webhooks)</li>
            <li>Paste the copied JSON as the value</li>
            <li>Save your changes</li>
          </ol>
        </AlertDescription>
      </Alert>
    </div>
  );
};

export default EnsFeatures; 