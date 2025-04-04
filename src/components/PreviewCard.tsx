
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { FolderPath, PreviewData } from '@/lib/types';
import { Copy, ExternalLink, RefreshCw } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';

interface PreviewCardProps {
  previewData: PreviewData | null;
  onFolderPathChange: (path: FolderPath) => void;
}

const PreviewCard: React.FC<PreviewCardProps> = ({ previewData, onFolderPathChange }) => {
  const { toast } = useToast();
  const [folderPath, setFolderPath] = useState<FolderPath>({
    username: '',
    repo: '',
    folder: `og-custom-${Math.random().toString(36).substring(2, 8)}`
  });
  const [loading, setLoading] = useState(false);

  const handleCopyUrl = () => {
    if (previewUrl) {
      navigator.clipboard.writeText(previewUrl);
      toast({ title: "Copied to clipboard", duration: 2000 });
    }
  };

  const handlePathChange = (field: keyof FolderPath, value: string) => {
    const newPath = { ...folderPath, [field]: value };
    setFolderPath(newPath);
    onFolderPathChange(newPath);
  };

  const handleRefreshPreview = () => {
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
    }, 1000);
  };

  // Construct the preview URL
  const previewUrl = folderPath.username && folderPath.repo && folderPath.folder 
    ? `https://cdn.jsdelivr.net/gh/${folderPath.username}/${folderPath.repo}/og/${folderPath.folder}`
    : null;

  // Construct the yodl preview URL (in a real app this would point to the actual Yodl OG Card Generator)
  const yodlPreviewUrl = previewUrl 
    ? `https://yodl.me/preview?url=${encodeURIComponent(previewUrl)}`
    : null;

  return (
    <Card className="w-full card-highlight">
      <CardHeader>
        <CardTitle>Preview Configuration</CardTitle>
        <CardDescription>
          Set up your GitHub repository details for asset storage
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <Label htmlFor="username">GitHub Username</Label>
            <Input 
              id="username"
              placeholder="e.g., username" 
              value={folderPath.username}
              onChange={(e) => handlePathChange('username', e.target.value)}
            />
          </div>
          
          <div>
            <Label htmlFor="repo">Repository Name</Label>
            <Input 
              id="repo" 
              placeholder="e.g., assets" 
              value={folderPath.repo}
              onChange={(e) => handlePathChange('repo', e.target.value)}
            />
          </div>
          
          <div>
            <Label htmlFor="folder">Folder Name</Label>
            <Input 
              id="folder" 
              placeholder="Auto-generated unique name" 
              value={folderPath.folder}
              onChange={(e) => handlePathChange('folder', e.target.value)}
            />
          </div>
        </div>

        {previewUrl && (
          <div className="mt-6 space-y-4">
            <div>
              <Label>Preview URL</Label>
              <div className="flex mt-1">
                <Input 
                  readOnly 
                  value={previewUrl}
                  className="font-mono text-sm"
                />
                <Button 
                  variant="outline" 
                  size="icon"
                  className="ml-2"
                  onClick={handleCopyUrl}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
            
            <div className="bg-muted rounded-md p-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium">Yodl Preview</h3>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8"
                  onClick={handleRefreshPreview}
                  disabled={loading}
                >
                  <RefreshCw className={cn(
                    "h-4 w-4 mr-2",
                    loading && "animate-spin"
                  )} />
                  Refresh
                </Button>
              </div>
              
              <div className="relative w-full h-[300px] bg-black/30 rounded-md overflow-hidden border border-border">
                {previewData ? (
                  <div className="w-full h-full flex items-center justify-center">
                    <div className="text-center">
                      <div className="text-lg font-bold gradient-text mb-2">Preview Simulation</div>
                      <div className="text-sm text-muted-foreground mb-4">
                        Files would be uploaded to:
                        <div className="font-mono mt-1 text-xs bg-secondary/50 p-2 rounded">/og/{folderPath.folder}/</div>
                      </div>
                      {previewData.files.inner && <div className="text-green-500 text-xs">✓ inner.png</div>}
                      {previewData.files.outer && <div className="text-green-500 text-xs">✓ outer.png</div>}
                      {previewData.files.overlay && <div className="text-green-500 text-xs">✓ overlay.png</div>}
                      
                      {(!previewData.files.inner || !previewData.files.outer || !previewData.files.overlay) && (
                        <div className="text-yellow-500 text-xs mt-2">Missing required files</div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                    Preview not available - upload files first
                  </div>
                )}
              </div>
              
              {yodlPreviewUrl && (
                <div className="mt-3 flex justify-end">
                  <Button variant="secondary" size="sm" className="flex items-center text-xs">
                    <ExternalLink className="h-3 w-3 mr-1" />
                    Open in Yodl Preview
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
      
      <CardFooter className="flex justify-between">
        <p className="text-xs text-muted-foreground">
          Files will be uploaded to this location when you proceed
        </p>
      </CardFooter>
    </Card>
  );
};

export default PreviewCard;
