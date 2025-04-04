
import React, { useState, useCallback, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ImageFile } from "@/lib/types";
import { LinkIcon, X, CheckCircle, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/use-toast";
import { Input } from "@/components/ui/input";

interface FileUploadProps {
  onFilesChange: (files: ImageFile[]) => void;
}

const FileUpload: React.FC<FileUploadProps> = ({ onFilesChange }) => {
  const { toast } = useToast();
  const [files, setFiles] = useState<ImageFile[]>([
    { name: 'inner', file: null, preview: null },
    { name: 'outer', file: null, preview: null },
    { name: 'overlay', file: null, preview: null },
  ]);
  const [urls, setUrls] = useState<{ [key: string]: string }>({
    inner: '',
    outer: '',
    overlay: '',
  });

  const validateImageUrl = useCallback((url: string, name: string): Promise<boolean> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        resolve(true);
      };
      img.onerror = () => {
        toast({
          title: "Invalid image URL",
          description: `The URL for ${name} does not appear to be a valid image.`,
          variant: "destructive"
        });
        resolve(false);
      };
      img.src = url;
    });
  }, [toast]);

  const handleUrlChange = useCallback(async (name: 'inner' | 'outer' | 'overlay', url: string) => {
    // Update the URL state
    setUrls(prev => ({ ...prev, [name]: url }));
    
    if (!url) {
      // Clear the preview if URL is empty
      const updatedFiles = files.map(item => 
        item.name === name ? { ...item, file: null, preview: null } : item
      );
      setFiles(updatedFiles);
      onFilesChange(updatedFiles);
      return;
    }

    // Validate the URL is an image
    if (await validateImageUrl(url, name)) {
      // Update the files state with the URL as preview
      const updatedFiles = files.map(item => 
        item.name === name ? { ...item, file: null, preview: url } : item
      );
      setFiles(updatedFiles);
      onFilesChange(updatedFiles);
    }
  }, [files, onFilesChange, validateImageUrl]);

  const handleApplyUrl = useCallback(async (name: 'inner' | 'outer' | 'overlay') => {
    const url = urls[name];
    if (url) {
      await handleUrlChange(name, url);
    }
  }, [urls, handleUrlChange]);

  const clearUrl = useCallback((name: 'inner' | 'outer' | 'overlay') => {
    setUrls(prev => ({ ...prev, [name]: '' }));
    const updatedFiles = files.map(item => 
      item.name === name ? { ...item, file: null, preview: null } : item
    );
    setFiles(updatedFiles);
    onFilesChange(updatedFiles);
  }, [files, onFilesChange]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {files.map(({ name, preview }) => (
        <Card 
          key={name}
          className="border-2 transition-all duration-200 animate-fade-in"
        >
          <CardContent className="p-4">
            <div className="text-center mb-3">
              <h3 className="text-lg font-semibold capitalize">{name}.png</h3>
              <p className="text-sm text-muted-foreground mb-4">
                {preview ? "URL added" : "Required"}
              </p>
            </div>

            {!preview ? (
              <div className="space-y-4">
                <div className="flex flex-col gap-2">
                  <Input
                    placeholder={`Enter ${name} image URL`}
                    value={urls[name]}
                    onChange={(e) => setUrls(prev => ({ ...prev, [name]: e.target.value }))}
                    className="text-sm"
                  />
                  <Button 
                    onClick={() => handleApplyUrl(name)}
                    disabled={!urls[name]}
                    className="w-full"
                  >
                    <LinkIcon className="h-4 w-4 mr-2" />
                    Apply URL
                  </Button>
                </div>
                <div className="text-xs text-muted-foreground mt-2">
                  <p>Supported formats: PNG, JPG, WebP</p>
                  <p>The image URL must be publicly accessible</p>
                </div>
              </div>
            ) : (
              <div className="relative">
                <div className="absolute -top-2 -right-2">
                  <Button
                    size="sm"
                    variant="destructive"
                    className="h-8 w-8 rounded-full p-0"
                    onClick={() => clearUrl(name)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                <div className="h-40 rounded-md overflow-hidden flex justify-center items-center bg-black/20">
                  <img 
                    src={preview} 
                    alt={`${name} preview`}
                    className="max-h-full object-contain"
                  />
                </div>
                <div className="flex items-center justify-between mt-2 text-sm">
                  <div className="text-green-500 flex items-center">
                    <CheckCircle className="h-4 w-4 mr-1" />
                    URL added
                  </div>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => window.open(preview, '_blank')}
                    className="h-6 p-0 text-xs"
                  >
                    <ExternalLink className="h-3 w-3 mr-1" />
                    Open
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export default FileUpload;
