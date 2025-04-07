import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ImageFile } from "@/lib/types";
import { X, CheckCircle, Upload, Loader2, Image as ImageIcon, RefreshCw, Info } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface FileUploadProps {
  onFilesChange: (files: ImageFile[]) => void;
}

// Suggested dimensions for each image type
const SUGGESTED_DIMENSIONS = {
  inner: { width: 1200, height: 800 },
  outer: { width: 880, height: 480 },
  overlay: { width: 600, height: 800 }
};

const FileUpload: React.FC<FileUploadProps> = ({ onFilesChange }) => {
  const { toast } = useToast();
  const [files, setFiles] = useState<ImageFile[]>([
    { name: 'inner', file: null, preview: null },
    { name: 'outer', file: null, preview: null },
    { name: 'overlay', file: null, preview: null },
  ]);
  const [loading, setLoading] = useState<{ [key: string]: boolean }>({
    inner: false,
    outer: false,
    overlay: false,
  });
  const [dimensions, setDimensions] = useState<{ [key: string]: { width: number, height: number } }>({
    inner: { width: 0, height: 0 },
    outer: { width: 0, height: 0 },
    overlay: { width: 0, height: 0 },
  });
  const [autoResize, setAutoResize] = useState<{ [key: string]: boolean }>({
    inner: false,
    outer: false,
    overlay: false,
  });
  
  // File input refs
  const fileInputRefs = {
    inner: useRef<HTMLInputElement>(null),
    outer: useRef<HTMLInputElement>(null),
    overlay: useRef<HTMLInputElement>(null),
  };

  // Helper function to resize an image
  const resizeImage = useCallback(async (file: File, maxWidth: number, maxHeight: number): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        
        // Calculate new dimensions while maintaining aspect ratio
        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width = Math.floor(width * ratio);
          height = Math.floor(height * ratio);
        }
        
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        
        if (!ctx) {
          reject(new Error('Could not get canvas context'));
          return;
        }
        
        ctx.drawImage(img, 0, 0, width, height);
        
        // Convert canvas to blob
        canvas.toBlob((blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('Could not convert canvas to blob'));
          }
        }, file.type);
      };
      
      img.onerror = () => {
        reject(new Error('Failed to load image for resizing'));
      };
      
      img.src = URL.createObjectURL(file);
    });
  }, []);

  // Process the selected file
  const processFile = useCallback(async (name: 'inner' | 'outer' | 'overlay', file: File) => {
    if (!file) return;
    
    setLoading(prev => ({ ...prev, [name]: true }));
    
    try {
      // Check if file is an image
      if (!file.type.startsWith('image/')) {
        throw new Error('Selected file is not an image');
      }
      
      let processedFile = file;
      let processedBlob: Blob = file;
      
      // If auto-resize is enabled, resize the image
      if (autoResize[name]) {
        const suggestedDims = SUGGESTED_DIMENSIONS[name];
        processedBlob = await resizeImage(file, suggestedDims.width, suggestedDims.height);
        
        // Create a new File from the blob
        processedFile = new File([processedBlob], file.name, { 
          type: file.type,
          lastModified: file.lastModified
        });
      }
      
      // Create a data URL from the processed file/blob
      const reader = new FileReader();
      const dataUrlPromise = new Promise<string>((resolve) => {
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(processedBlob);
      });
      
      const dataUrl = await dataUrlPromise;
      
      // Get image dimensions
      const imgDimensions = await getImageDimensions(dataUrl);
      setDimensions(prev => ({ 
        ...prev, 
        [name]: { width: imgDimensions.width, height: imgDimensions.height } 
      }));
      
      // Update the files state
      const updatedFiles = files.map(item => 
        item.name === name ? { ...item, file: processedFile, preview: dataUrl } : item
      );
      setFiles(updatedFiles);
      onFilesChange(updatedFiles);
      
      // Show success message
      const resizeMsg = autoResize[name] ? ' and resized to recommended dimensions' : '';
      toast({
        title: `${name}.png uploaded`,
        description: `Image uploaded successfully${resizeMsg}`,
      });
    } catch (error) {
      console.error(`Error processing ${name} image:`, error);
      toast({
        title: `Failed to process ${name}.png`,
        description: error instanceof Error ? error.message : 'Unknown error processing image',
        variant: "destructive"
      });
    } finally {
      setLoading(prev => ({ ...prev, [name]: false }));
    }
  }, [files, onFilesChange, toast, autoResize, resizeImage]);

  // Get image dimensions
  const getImageDimensions = (dataUrl: string): Promise<{width: number, height: number}> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        resolve({ width: img.width, height: img.height });
      };
      img.src = dataUrl;
    });
  };

  // Handle file input change
  const handleFileChange = useCallback((name: 'inner' | 'outer' | 'overlay', event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      processFile(name, file);
    }
  }, [processFile]);

  // Handle drag and drop
  const handleDrop = useCallback((name: 'inner' | 'outer' | 'overlay', event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    
    const file = event.dataTransfer.files?.[0];
    if (file) {
      processFile(name, file);
    }
  }, [processFile]);

  const handleDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
  }, []);

  // Toggle auto-resize
  const toggleAutoResize = useCallback((name: 'inner' | 'outer' | 'overlay') => {
    setAutoResize(prev => ({ ...prev, [name]: !prev[name] }));
  }, []);

  // Clear file
  const clearFile = useCallback((name: 'inner' | 'outer' | 'overlay') => {
    const updatedFiles = files.map(item => 
      item.name === name ? { ...item, file: null, preview: null } : item
    );
    setFiles(updatedFiles);
    onFilesChange(updatedFiles);
    
    // Reset dimensions
    setDimensions(prev => ({ ...prev, [name]: { width: 0, height: 0 } }));
    
    // Reset file input
    if (fileInputRefs[name].current) {
      fileInputRefs[name].current.value = '';
    }
  }, [files, onFilesChange]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Upload Images</h2>
        <div className="flex items-center gap-2">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-1 text-sm">
                  <Info className="h-4 w-4 text-muted-foreground" />
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p className="text-xs max-w-xs">
                  Upload images for your OG card. You can enable auto-resize 
                  for each image to match the recommended dimensions.
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {files.map(({ name, preview }) => {
          const suggestedDims = SUGGESTED_DIMENSIONS[name];
          const currentDims = dimensions[name];
          const isCorrectSize = currentDims.width === suggestedDims.width && 
                               currentDims.height === suggestedDims.height;
          
          return (
            <Card 
              key={name}
              className="border-2 transition-all duration-200 animate-fade-in"
            >
              <CardContent className="p-4">
                <div className="text-center mb-3">
                  <h3 className="text-lg font-semibold capitalize">{name}.png</h3>
                  <p className="text-sm text-muted-foreground mb-1">
                    {preview ? "Image uploaded" : "Required"}
                  </p>
                  <p className="text-xs text-blue-500">
                    Suggested: {suggestedDims.width}×{suggestedDims.height}px
                  </p>
                </div>

                {!preview ? (
                  <div 
                    className="border-2 border-dashed rounded-md p-4 flex flex-col items-center justify-center h-40 text-center cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => fileInputRefs[name].current?.click()}
                    onDrop={(e) => handleDrop(name, e)}
                    onDragOver={handleDragOver}
                  >
                    <input
                      type="file"
                      ref={fileInputRefs[name]}
                      className="hidden"
                      accept="image/*"
                      onChange={(e) => handleFileChange(name, e)}
                    />
                    
                    {loading[name] ? (
                      <Loader2 className="h-10 w-10 text-muted-foreground animate-spin" />
                    ) : (
                      <>
                        <ImageIcon className="h-10 w-10 text-muted-foreground mb-2" />
                        <div className="text-sm font-medium mb-1">
                          Click or drag to upload
                        </div>
                        <p className="text-xs text-muted-foreground">
                          PNG, JPG, WebP up to 10MB
                        </p>
                      </>
                    )}
                  </div>
                ) : (
                  <div className="relative">
                    <div className="absolute -top-2 -right-2">
                      <Button
                        size="sm"
                        variant="destructive"
                        className="h-8 w-8 rounded-full p-0"
                        onClick={() => clearFile(name)}
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
                    
                    {/* Show image dimensions */}
                    <div className="mt-2 text-xs text-muted-foreground">
                      <div className="flex justify-between">
                        <span>Current: {currentDims.width}×{currentDims.height}px</span>
                        {isCorrectSize ? (
                          <span className="text-green-500">✓ Perfect</span>
                        ) : (
                          <span className="text-amber-500">≠ Different size</span>
                        )}
                      </div>
                    </div>
                    
                    {/* Resize option */}
                    <div className="mt-3 flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <Switch
                          id={`auto-resize-${name}`}
                          checked={autoResize[name]}
                          onCheckedChange={() => toggleAutoResize(name)}
                          disabled={preview !== null}
                        />
                        <Label htmlFor={`auto-resize-${name}`} className="text-xs">
                          Auto-resize next upload
                        </Label>
                      </div>
                      
                      {!isCorrectSize && preview && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 text-xs"
                          onClick={() => {
                            // Trigger file input with auto-resize enabled
                            setAutoResize(prev => ({ ...prev, [name]: true }));
                            fileInputRefs[name].current?.click();
                          }}
                        >
                          <RefreshCw className="h-3 w-3 mr-1" />
                          Resize
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

export default FileUpload;
